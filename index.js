const {app, BrowserWindow, protocol} = require('electron')
const electron = require('electron');
const path = require('path')
const fs = require('fs')

const nativeTheme = electron.nativeTheme;
// const discordRPC = require('discord-rich-presence')('749317071145533440')
const Mpris = require('mpris-service');
const { session } = require('electron')
let pos_atr = {durationInMillis: 0};
let currentPlayBackProgress
const mpris = Mpris({
    name: 'AppleMusicForLinux',
    identity: 'Apple Music For Linux',
    supportedUriSchemes: [],
    supportedMimeTypes: [],
    supportedInterfaces: ['player']
});
mpris.getPosition = function () {
    const durationInMicro = pos_atr.durationInMillis * 1000;
    const percentage = parseFloat(currentPlayBackProgress) || 0;
    return durationInMicro * percentage;
}
mpris.canQuit = true;
mpris.canControl = true;
mpris.canPause = true;
mpris.canPlay = true;
mpris.canGoNext = true;
mpris.metadata = {'mpris:trackid': '/org/mpris/MediaPlayer2/TrackList/NoTrack'}
mpris.playbackStatus = 'Stopped'

const playbackStatusPlay = 'Playing';
const playbackStatusPause = 'Paused';
const playbackStatusStop = 'Stopped';


function setPlaybackIfNeeded(status) {
    if (mpris.playbackStatus === status) {
        return
    }
    mpris.playbackStatus = status;
}
const filter = {
    urls: ['https://music.apple.com/','https://music.apple.com/us/browse']
}

async function createWindow() {
    // Create the browser window.


    // protocol.registerFileProtocol('cache', (request, callback)=>{
    //     // request.url = "file://" + );
    //     console.log("Loaded custom cache ", request.url)
    //     // const buffer = fs.readFileSync()
    //     // the new url is ='D:\\yunshipei\\dawn\\override\\sgoutong.baidu.com\\main.css'
    //     callback({path: path.join(__dirname,request.url.substr(8)), mimeType:'text/html', statusCode:200, method: 'GET'})
    // })
    //
    // session.defaultSession.webRequest.onBeforeRequest(filter,(details, callback) => {
    //     // const url  = "file://" + path.join(__dirname, './assets/_cached.html');
    //     console.log(details.url)
    //     callback({redirectURL:'cache://assets/_cached.html'})
    //
    // })


    const win = new BrowserWindow({
        icon: path.join(__dirname, './assets/icon.png'),
        width: 1024,
        height: 600,
        minWidth: 300,
        minHeight: 300,
        frame: true,
        // Enables DRM
        webPreferences: {
            plugins: true,
            preload: path.join(__dirname, './assets/MusicKitInterop.js'),
            allowRunningInsecureContent: true,
        }
    })
    win.setMenuBarVisibility(false);

    // Only Run this if you plan on using this feature.
    // setInterval(async () => {
    //     pos_atr = await getMusicKitAttributes();
    //     currentPlayBackProgress = await  win.webContents.executeJavaScript('MusicKit.getInstance().currentPlaybackProgress')
    //
    // },10000)


    mpris.on('playpause', async () => {
        if (mpris.playbackStatus === 'Playing') {
            await win.webContents.executeJavaScript('MusicKit.getInstance().pause()')
        } else {
            await win.webContents.executeJavaScript('MusicKit.getInstance().play()')
        }
        const attributes = await getMusicKitAttributes()
        await updateMetaData(attributes);
    });
    mpris.on('play', async () => {
        await win.webContents.executeJavaScript('MusicKit.getInstance().play()')
        const attributes = await getMusicKitAttributes()
        await updateMetaData(attributes);
    });
    mpris.on('pause', async () => {
        await win.webContents.executeJavaScript('MusicKit.getInstance().pause()')
        const attributes = await getMusicKitAttributes()
        await updateMetaData(attributes);
    });
    mpris.on('next', async () => {
        await win.webContents.executeJavaScript('MusicKit.getInstance().skipToNextItem()')
        const attributes = await getMusicKitAttributes()
        await updateMetaData(attributes);
    });
    mpris.on('previous', async () => {
        await win.webContents.executeJavaScript('MusicKit.getInstance().skipToPreviousItem()')
        const attributes = await getMusicKitAttributes()
        await updateMetaData(attributes);
    });


    electron.ipcMain.on('mediaItemStateDidChange', (item, a) => {
        updateMetaData(a)
    })

    electron.ipcMain.on('playbackStateDidChange', (item, a) => {
        // updateMetaData(a)
        switch (a) {
            case 0:
                console.log("NONE")
                setPlaybackIfNeeded(playbackStatusPause);
                break;
            case 1:
                console.log("loading")
                setPlaybackIfNeeded(playbackStatusPause);
                break;
            case 2:
                console.log("playing")
                setPlaybackIfNeeded(playbackStatusPlay);
                break;
            case 3:
                console.log("paused")
                setPlaybackIfNeeded(playbackStatusPause);
                break;
            case 4:
                console.log("stopped")
                setPlaybackIfNeeded(playbackStatusStop);
                break;
            case 5:
                console.log("ended")
                break;
            case 6:
                console.log("seeking")
                break;
            case 7:
                console.log("waiting")
                break;
            case 8:
                console.log("stalled")
                break;
            case 9:
                console.log("completed")
                break;

        }

    })



    win.webContents.once('did-stop-loading', async () => {
        await win.webContents.executeJavaScript(`MusicKitInterop.init()`)
        await win.webContents.insertCSS('::-webkit-scrollbar { display: none; }')
    })


    await win.loadURL("https://music.apple.com/us/browse");


    async function getMusicKitAttributes() {
        return await win.webContents.executeJavaScript(`MusicKitInterop.getAttributes()`);
    }

    async function updateMetaData(attributes) {

        let m = {'mpris:trackid': '/org/mpris/MediaPlayer2/TrackList/NoTrack'}
        if (attributes == null) {
            return
        } else if (attributes.playParams.id === 'no-id-found') {

        } else {
            m = {
                'mpris:trackid': mpris.objectPath(`track/${attributes.playParams.id.replace(/[\.]+/g, "")}`),
                'mpris:length': attributes.durationInMillis * 1000, // In microseconds
                'mpris:artUrl': `${attributes.artwork.url.replace('/{w}x{h}bb', '/100x100bb')}`,
                'xesam:title': `${attributes.name}`,
                'xesam:album': `${attributes.albumName}`,
                'xesam:artist': [`${attributes.artistName}`,],
                'xesam:genre': attributes.genreNames
            }
        }
        if (mpris.metadata["mpris:trackid"] === m["mpris:trackid"]) {
            return
        }
        mpris.metadata = m
    }


}



nativeTheme.themeSource = 'dark';
app.commandLine.appendSwitch('--no-sandbox')
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
app.whenReady().then(createWindow).catch(e => {
    console.log(e)
})
app.on('window-all-closed', () => {
    mpris.metadata = {'mpris:trackid': '/org/mpris/MediaPlayer2/TrackList/NoTrack'}
    mpris.playbackStatus = 'Stopped'
    app.quit()
})
