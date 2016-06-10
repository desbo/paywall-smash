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
    socket.on('smash', event => {
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
        }, 1000)
      }
    });
  },

  handleClick() {
    this.setState({ destroyed: true });
    this.props.onClick();
  },

  render: function() {
    const row = Math.floor(this.props.num / (perRow + 1));
    const offset = row % 2 === 0;

    return (
      <div className={'brick ' + (this.state.destroyed ? 'destroyed ' : '') + (offset ? 'offset' : '')}
           onClick={this.handleClick}></div>
    );
  }
});

export default Brick;