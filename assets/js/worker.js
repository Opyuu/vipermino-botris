importScripts('cobra.js');

onmessage = (e) => {
    const message = JSON.stringify(e.data);
    Module.ccall('on_message', 'number', ['string'], [message]);
}
