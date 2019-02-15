
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

var fresh_list = [
    {
      id: 1,
      song: 'La Macarena',
      artist: 'Los Del Rio',
      count: 18
    },
    {
      id: 2,
      song: 'Never gonna give you up',
      artist: 'Rick Astley',
      count: 16
    },
    {
      id: 3,
      song: 'Who let the dogs out',
      artist: 'Baha Men',
      count: 12
    },
    {
      id: 4,
      song: 'Back in Black',
      artist: 'AC/DC',
      count: 8
    }
  ];

//playlist socket integration
io.on('connection', function (socket) {
  console.log('socket connected to room:', socket.handshake.query.room)
  socket.join(socket.handshake.query.room);
  io.in(socket.handshake.query.room).emit('fresh_list', fresh_list)
  socket.on('new_song', function (data) {
      fresh_list.push(data); // for now im pushing to a variable, will add a room specific db later 
      io.in(socket.handshake.query.room).emit('new_song', data)
  });
  socket.on('plus_minus', function (data) {
      if(data.dir == 'up'){
          fresh_list[data.index].count++;
      }else{
          fresh_list[data.index].count--;
      }
      if(fresh_list[data.index].count <= 0){
          fresh_list.splice(data.index,1)
      }
      fresh_list = _.orderBy(fresh_list, ['count'],['desc']); 
      // for now im pushing to a variable, will add a room specific db later 
        io.in(socket.handshake.query.room).emit('plus_minus', fresh_list)
  });
  socket.on('delete_song', function (data) {
      fresh_list.splice(data,1)
        // for now im pushing to a variable, will add a room specific db later 
        io.in(socket.handshake.query.room).emit('delete_song', data)
  });
});

app.get('/login', function(req, res) {
  console.log('login hit')
  var scopes = ['user-read-private', 'user-read-email'];
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
      //obj.picture = resp.images[0].url.split('//')[1];
      send_obj = JSON.stringify(obj);
      console.log(send_obj);
      res.redirect('http://localhost:8080/#/join?user_data='+ send_obj);
    }).catch(function(err){
      console.log(err)
      res.send(err);
    })
  }, function(err) {
    console.log('Something went wrong when retrieving the access token!', err.message);
  });
});


//routes

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Server started on port ${port}`));