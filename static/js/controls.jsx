import socket from './socket';

const Controls = React.createClass({
  start() {
    socket.emit('start');
  },

  stop() {
    socket.emit('stop');
  },

  reset() {
    socket.emit('reset');
  },

  render() {
    return (
      <div>
        <button onClick={this.start}>start</button>
        <button onClick={this.stop}>stop</button>
        <button onClick={this.reset}>reset</button>
      </div>
    );
  }
});

ReactDOM.render(<Controls />, document.getElementById('controls'));
