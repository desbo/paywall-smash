import Brick from './brick.jsx!';
import Scores from './scores.jsx!';
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
        {(!this.props.active) && <Scores scores={this.props.scores} />}

        {this.props.bricks.map(x => {
          const destroyed = this.props.destroyed.indexOf(x) !== -1;
          return <Brick key={x} num={x} onClick={this.destroyBrick.bind(this, x)} destroyed={destroyed} />
        })}
      </div>
    );
  }
});

export default Wall;
