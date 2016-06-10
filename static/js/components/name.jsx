import socket from '../socket';

const NameEntry = React.createClass({
  getInitialState() {
      return {
          name: ''
      };
  },

  updateName(event) {
    this.setState({
      name: event.target.value
    });
  },

  submit() {
    this.props.onSubmit(this.state.name);
  },

  render() {
    return (
      <div>
        <section className="name-entry">
          <input value={this.state.name} onChange={this.updateName}
                  placeholder="enter your name" />
        </section>


          <section className="submit-button">
            {this.state.name &&
            <div>
              <button onClick={this.submit}>PLAY</button>
            </div>
            }
          </section>
      </div>
    );
  }
});

export default NameEntry;
