import NameEntry from './components/name.jsx!';
import Wall from './components/wall.jsx!';
import socket from './socket';

const NAME_ENTRY = 0;
const GAME = 1;

const numBricks = 500;
const arr = [];

for (var i = 0; i < numBricks; i++) {
  arr.push(i);
}

let destroyed;

socket.on('init', event => {
  destroyed = event.destroyed;
});

const Game = React.createClass({
  getInitialState() {
      return {
          state: NAME_ENTRY,
          name: ''
      };
  },

  setName(name) {
    this.setState({
      state: GAME,
      name: name
    });
  },

  render() {
    return (this.state.state === NAME_ENTRY
      ? <NameEntry onSubmit={this.setName} />
      : <Wall bricks={this.props.bricks} name={this.state.name} destroyed={destroyed} />);
  }
});

ReactDOM.render(<Game bricks={arr}/>, document.getElementById('wall'));
