
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
//Middleware
app.use(bodyParser.json());
app.use(cors());

var server = require('http').Server(app);
var io = require('socket.io')(server);

const _ = require('lodash');

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


//routes

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Server started on port ${port}`));