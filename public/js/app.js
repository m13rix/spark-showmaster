window.addEventListener('load', async () => {
    const screenSaverManager = new ScreenSaverManager();
    window.screenSaverManager = screenSaverManager;
    const mediaBrowser = new MediaBrowser();
    const timeline = new Timeline();
    window.mediaBrowser = mediaBrowser;
    window.timeline = timeline;
});
