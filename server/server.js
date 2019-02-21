
const express       = require('express');
const bodyParser    = require('body-parser');
const cors          = require('cors');
const rp            = require('request-promise'); 
const SpotifyWebApi = require('spotify-web-api-node');
const config        = require('./config.js');
const app = express();
//Middleware
app.use(bodyParser.json());
app.use(cors());

var server = require('http').Server(app);
var io = require('socket.io')(server);
const _ = require('lodash');

// The API object we'll use to interact with the API
var spotifyApi = new SpotifyWebApi({
  clientId : config.spotify.clientId,
  clientSecret : config.spotify.clientSecret,
  redirectUri : config.spotify.redirectUri
});

var playlists = {}; //for now, one day I will make this into a DB but this is for quick testing

//playlist socket integration
io.on('connection', function (socket) {
  //initial socket connection
  if(playlists[socket.handshake.query.room]){
    console.log('socket connected to room:', socket.handshake.query.room)
    socket.join(socket.handshake.query.room);
    io.in(socket.handshake.query.room).emit('fresh_list', playlists[socket.handshake.query.room])
  }
  //socket functions
  socket.on('new_song', function (data) {
      playlists[data.code].playlist.push(data); // for now im pushing to a variable, will add a room specific db later 
      io.in(socket.handshake.query.room).emit('new_song', data)
  });
  socket.on('plus_minus', function (data) {
    if(data.dir == 'up'){
      playlists[data.code].playlist[data.index].count++;
    }else{
      playlists[data.code].playlist[data.index].count--;
    }
    if(playlists[data.code].playlist[data.index].count <= 0){
      playlists[data.code].playlist.splice(data.index,1)
    }
    playlists[data.code].playlist = _.orderBy(playlists[data.code].playlist, ['count'],['desc']); 
    // for now im pushing to a variable, will add a room specific db later 
    io.in(socket.handshake.query.room).emit('plus_minus', playlists[data.code].playlist)
  });
  socket.on('delete_song', function (data) {
    playlists[data.code].playlist.splice(data,1)
    // for now im pushing to a variable, will add a room specific db later 
    io.in(socket.handshake.query.room).emit('delete_song', data)
  });
});

app.get('/login', function(req, res) {
  console.log('login hit')
  var scopes = ['user-read-private', 'user-read-email', 'user-read-playback-state', 'user-modify-playback-state'];
  var authorizeURL = spotifyApi.createAuthorizeURL(scopes, null, true);
  res.send(authorizeURL);
});

app.get('/login_redirect', function(req,res){
  var authorizationCode = req.query.code;
  var access_token;
  var refresh_token;
  spotifyApi.authorizationCodeGrant(authorizationCode)
  .then(function(data) {
    access_token = data.body.access_token;
    refresh_token = data.body.refresh_token;
    var options = {
      method: 'GET',
      uri: 'https://api.spotify.com/v1/me',
      headers: {
        "Authorization": "Bearer " + data.body.access_token
      }
    }
    return rp(options).then(function(resp){
      resp = JSON.parse(resp);
      var obj = {};
      obj.access_token = access_token;
      obj.refresh_token = refresh_token;
      obj.name = resp.display_name;
      obj.uid = resp.id;
      obj.picture = resp.images[0].url;
      send_obj = JSON.stringify(obj);
      res.redirect('http://localhost:8080/#/join?user_data='+ encodeURIComponent(send_obj));
    }).catch(function(err){
      console.log(err)
      res.send(err);
    })
  }, function(err) {
    console.log('Something went wrong when retrieving the access token!', err.message);
  });
});

app.get('/search_songs', function(req,res){
  var search_term = req.query.song;
  if(req.query.artist){
    search_term = search_term + ' ' + req.query.artist
  }
  var options = {
    method: 'GET',
    uri: 'https://api.spotify.com/v1/search',
    headers: {
      "Authorization": 'Bearer ' + req.query.ua
    },
    qs: {
      type: 'track',
      q: search_term,
      limit: 5
    }
  };
  rp(options).then(function(resp){
   resp = JSON.parse(resp);
    var suggestions = [];
    _.forEach(resp.tracks.items, function(item){
        suggestions.push({
          'song': item.name,
          'id': item.id,
          'uri': item.uri,
          'picture': item.album.images[0].url,
          'artist': item.artists[0].name,
          'count': 5 // for votes later on
        })
    })
    res.send(suggestions);
  }).catch(function(err){
    console.log(err);
    res.status(400).send("failure");
  })
})


app.post('/create_party', function(req,res){
  var code = makeid();
  var party = {
    code: code,//will generate user friendly code
    name: req.body.name,
    created_by: req.body.creator_id,
    created_on: Date.now(),
    playlist: []
  }
  playlists[code] = party;
  res.send(code);//code to redirect user to playlist
});

app.get('/get_active_devices', function(req,res){
  var options = {
    method: 'GET',
    uri: 'https://api.spotify.com/v1/me/player/devices',
    headers: {
      "Authorization": 'Bearer ' + req.query.ua
    }
  };
  rp(options).then(function(resp){
    var devices = JSON.parse(resp).devices;
    res.send(devices);
  }).catch(function(err){
    console.log(err);
    res.status(400).send("failure");
  })
});

app.post('/play_song', function(req,res){
  var options = {
    method: 'PUT',
    uri: 'https://api.spotify.com/v1/me/player/play',
    headers: {
      "Authorization": 'Bearer ' + req.body.ua
    },
    qs: {
      "device_id": req.body.device_id
    },
    body:{
      "uris": [req.body.uri]
    },
    json: true
  };
  rp(options).then(function(resp){
    console.log(resp);
    res.sendStatus(200)
  }).catch(function(err){
    console.log(err);
    res.status(400).send("failure");
  })
});

app.post('/pause_song', function(req,res){
  var options = {
    method: 'PUT',
    uri: 'https://api.spotify.com/v1/me/player/pause',
    headers: {
      "Authorization": 'Bearer ' + req.body.ua
    },
    qs: {
      "device_id": req.body.device_id
    }
  };
  rp(options).then(function(resp){
    res.sendStatus(200)
  }).catch(function(err){
    console.log(err);
    res.status(400).send("failure");
  })
});

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  for (var i = 0; i < 5; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

//routes

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Server started on port ${port}`));