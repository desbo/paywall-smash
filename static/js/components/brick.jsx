const socket = io.connect(`${window.location.hostname}:3000`);

const Brick = React.createClass({
  componentDidMount: function() {
    socket.on('smash', event => {
      console.log(event.brick);

      if (event.brick === this.props.num) {
        console.log('destryoing', event.brick);
        this.setState({ destroyed: true });
      }
    });
  },

  getInitialState: () => {
    return { destroyed: false };
  },

  destroy: function() {
    socket.emit('smash', { brick: this.props.num });
    this.setState({ destroyed: true });
  },

  render: function() {
    return (
        <div className={'brick ' + (this.state.destroyed ? 'destroyed' : '')}
             onClick={this.destroy}></div>
    );
  }
});

export default Brick;
