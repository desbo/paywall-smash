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

let destroyed = [];

const Game = React.createClass({
  getInitialState() {
    return {
      active: true,
      state: NAME_ENTRY,
      name: '',
      destroyed: [],
      scores: {}
    };
  },


  componentDidMount() {
    socket.on('reset', () => {
      return this.setState({
        active: true,
        destroyed: [],
        scores: {}
      });
    });

    socket.on('init', event => {
      this.setState({
        destroyed: event.destroyed,
        active: event.active,
        scores: event.scores
      });
    });

    socket.on('start', () => {
      this.setState({ active: true });
    });

    socket.on('stop', event => {
      this.setState({
        active: false,
        scores: event.scores
      });
    });
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
      : <Wall active={this.state.active}
              scores={this.state.scores}
              bricks={this.props.bricks}
              name={this.state.name}
              destroyed={this.state.destroyed} />);
  }
});

ReactDOM.render(<Game bricks={arr}/>, document.getElementById('wall'));
