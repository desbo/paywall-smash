import socket from '../socket';

const perRow = 13;

const Brick = React.createClass({
  getInitialState: () => {
    return {
      destroyed: false,
      destroyer: '',
      showName: false
    };
  },

  componentDidMount: function() {
    socket.on('reset', () => {
      return this.setState({
        destroyed: false,
        destroyer: '',
        showName: false
      });
    });

    socket.on('smash', event => {
      if (event.destroyed.indexOf(this.props.num) !== -1) {
        this.setState({ destroyed: true });
      }

      if (event.brick === this.props.num) {
        this.setState({
          destroyed: true,
          destroyer: event.player,
          showName: true
        });

        setTimeout(() => {
          this.setState({
            showName: false
          })
        }, 1000);
      }
    });
  },

  handleClick() {
    if (!this.state.destroyed) {
      this.setState({ destroyed: true });
      this.props.onClick();
    }
  },

  render: function() {
    const row = Math.floor(this.props.num / (perRow + 1));
    const offset = row % 2 === 0;

    return (
      <div className={'brick ' + ((this.props.destroyed || this.state.destroyed) ? 'destroyed ' : '') + (offset ? 'offset' : '')}
           onClick={this.handleClick}>
           <span className="player-name">{this.state.showName && this.state.destroyer}</span>
      </div>
    );
  }
});

export default Brick;
