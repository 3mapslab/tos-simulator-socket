const { ContainerSimulatorHelper } = require('../helpers');
const CHANNEL_NAMES = {
  CONTAINERS: 'containers',
}
module.exports = class SocketWorker {

  constructor(socket) {
    this._socket = socket;
    console.info('[' + Date().toString() + '] ' + `Client connected [id=${socket.id}]`);
    this._client = "";
    this._subscribedChannels = [];
    this.registerSocketEvents();
    ContainerSimulatorHelper.getInstance().on('container_operation', this.handleContainerOperation.bind(this));
  }

  registerSocketEvents() {
    if (!this._socket) {
      return;
    }
    // when socket disconnects, remove it from the list:
    this._socket.on("disconnect", () => {
      console.info('[' + Date().toString() + '] ' + `Client gone [id=${this._socket.id}]`);
    });
  }

  getSubscribedChannels() {
    return this._subscribedChannels;
  }

  subscribeChannel(channel) {
    this._subscribedChannels.push({
      channel: channel,
    });
    this.handleChannel(channel);

  }

  unsubscribeChannel(channel) {
    //todo
    for (let i = 0; i < this._subscribedChannels.length; i++) {
      if (this._subscribedChannels[i].channel == channel) {
        this._subscribedChannels.splice(i, 1);
        break;
      }
    }
    this._socket.removeAllListeners(channel);
    ContainerSimulatorHelper.getInstance().off('container_operation', this.handleContainerOperation.bind(this));
  }

  handleChannel(channel) {
    console.log('[' + Date().toString() + '] ', "Channel name =>", channel, " must be handled");
    switch (channel) {
      case CHANNEL_NAMES.CONTAINERS:
        this._handleContainersChannel();
        break;
      default:
        this._handleDefaultChannel();
        break;
    }
  }

  _handleDefaultChannel() {
  }

  _handleContainersChannel() {
    //find a way to send current state of containers
  }

  handleContainerOperation(operation) {
    if (this._socket) {
      this._socket.emit(CHANNEL_NAMES.CONTAINERS, operation);
    }
  }
};
