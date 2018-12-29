var manifestUri =
    'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd';

function rand() {
  return Math.random();
}

function initApp() {
  // Install built-in polyfills to patch browser incompatibilities.

  Plotly.plot('speedmonitor', [{
    y: [0.0],
    mode: 'lines',
    name: 'WiFi',
    line: {color: '#80CAF6'}
  }, {
    y: [0.0],
    mode: 'lines',
    name: 'LTE',
    line: {color: '#DF56F1'}
  }], {
    yaxis: {
      title: 'Kbps'
    }});

}


function onErrorEvent(event) {
  // Extract the shaka.util.Error object from the event.
  onError(event.detail);
}

function onError(error) {
  // Log the error.
  console.error('Error code', error.code, 'object', error);
}


document.addEventListener('DOMContentLoaded', initApp);

let reqs = {};

function sendToMain(request){
    const {ipcRenderer} = require('electron')
    console.log('got request from dashjs: ');
    console.log(request.detail);
    // console.log(request);
    const req_id = (new Date()).getMilliseconds() +'@' + request.detail.url;
    reqs[req_id] = request.detail;
    ipcRenderer.send('request-download', {req_id: req_id, url:request.detail.url, httpreq: request.detail})
}

document.addEventListener('xhr-load',sendToMain);

const {ipcRenderer} = require('electron')

ipcRenderer.on('asynchronous-reply', (event, arg) => {
  console.log(arg) // prints "pong"
})
ipcRenderer.send('asynchronous-message', {msg:'ping'});

ipcRenderer.on('request-download-data', function (event, arg) {
  console.log(`got request-download-data:`);
  var req = reqs[arg.req_id];
  var pe = new ProgressEvent()

});

ipcRenderer.on('request-download-end', function (event, arg) {
  if (arg.lte){
      Plotly.extendTraces('speedmonitor', {
        y: [[arg.kbps]]
      }, [1]);
  }
  else{
    Plotly.extendTraces('speedmonitor', {
      y: [[arg.kbps]]
    }, [0]);
  }

  // console.log(`request-download-end:`);
  var req = reqs[arg.req_id];
  // console.log(req);
  delete reqs[arg.req_id];
  // console.log(arg.resp);
  var resp = new XMLHttpRequest();

  req.response = {
    response:arg.databuf.buffer,
    statusText:arg.resp.statusMessage,
    status:arg.resp.statusCode,
    responseURL:req.url
  };
  // req.response.response = arg.databuf;
  const evtdict = {lengthComputable:true,loaded:arg.databuf.length, total:arg.databuf.length};
  var pe = new ProgressEvent('progress',evtdict);
  req.progress(pe);
  req.onload();
  req.onend();
  //TODO(tq): handle abort and error
});