const host = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
const socket = io.connect(host);

export default socket;
