const { ContainerSimulatorHelper } = require('./app/helpers');
const SocketWorker = require('./app/worker/socketworker');

var app = require('express')();
var http = require('http').Server(app);
var ioServer = require('socket.io');
var ioSocket = ioServer(http);

function initialize() {
    //start publishing even if no one is listening    
    ContainerSimulatorHelper.getInstance().run();

    this.clients = new Map();

    ioSocket.on('connection', function (socket) {
        console.info('[' + Date().toString() + '] ' + `Client connected [id=${socket.id}]`);
        var socketWorker = new SocketWorker(socket);
        socket.on('subscribeChannel', (message) => {
            socketWorker.subscribeChannel(message.channel);
            socket.emit("subscribedChannel", {
                channel: message.channel
            });
            clients.set(socket, true);
        });
        socket.on('unsubscribeChannel', (message) => {
            console.log('[' + Date().toString() + '] ' + `unsubscribeChannel`, message);
            socketWorker.unsubscribeChannel(message.channel);
            socket.emit("unsubscribedChannel", {
                channel: message.channel
            });
            clients.set(socket, false);
        });
    });
    http.listen(3000, function () {
        console.log(new Date(), 'Listening on *:3000');
    });
}
//Throw the first stone
initialize();
