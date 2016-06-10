import Brick from './brick.jsx!';
import socket from '../socket';

const Wall = React.createClass({
  destroyBrick(x) {
    return socket.emit('smash', {
      brick: x,
      player: this.props.name
    });
  },

  render() {
    return (
      <div className="wall">
        {this.props.bricks.map(x =>
          <Brick key={x} num={x} onClick={this.destroyBrick.bind(this, x)} />
        )}
      </div>
    );
  }
});

export default Wall;
