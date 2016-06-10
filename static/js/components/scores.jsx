

const Scores = React.createClass({
  render() {
    const scores = this.props.scores;

    const players = Object.keys(scores).sort((a, b) => {
      return scores[b] - scores[a];
    });

    const total = players.reduce((total, player) => {
      return total + scores[player]
    }, 0);

    return (
      <div className="scores">
        <h1>TOTAL DONATIONS: £{total}</h1>

        <ol>
          {players.map(player => <li>{player + ': £' + scores[player]}</li>)}
        </ol>
      </div>
    );
  }
});

export default Scores;
