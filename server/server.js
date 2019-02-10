const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const server = express();


//Middleware
server.use(bodyParser.json());
server.use(cors());

//routes

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Server started on port ${port}`));