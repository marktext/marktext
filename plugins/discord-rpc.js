module.exports = () => {
    const RPC = require('discord-rpc')
    const client = new RPC.Client({
        transport: 'ipc'
    })

    client.on('ready', async () => {
        client.setActivity({
            largeImageKey: 'marktext-logo',
            largeImageText: 'Editing a file',
            startTimestamp: new Date()
        }).catch(err => { console.log(err) })
    })

    client.login({
        clientId: 'YOUR APPLICATION ID HERE'
    }).catch(err => { console.log(err) })
}
