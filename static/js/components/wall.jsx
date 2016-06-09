import Brick from './brick.jsx!'

const Wall = (props) => {
  const bricks = 1000;
  const arr = [];

  for (var i = 0; i < bricks; i++) {
    arr.push(i);
  }

  return (
    <div className="wall">
      {arr.map(i => <Brick num={i} key={i}/>)}
    </div>);
}


export default Wall;
