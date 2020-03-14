const Koa = require('koa');
const fs = require('fs');
const path = require('path')
const staticCache = require('koa-static-cache')
const app = new Koa();
const render = require('koa-ejs');
const gzip = require('koa-gzip');
const cors = require('kcors');
const bodyParser = require('koa-bodyparser');
const router = require('koa-router')();
app.use(bodyParser());
app.use(gzip());
app.use(cors());

app.use(staticCache(path.join(__dirname, 'public'), {
  maxAge: 31536000000
}));
render(app, {
  root: path.join(__dirname, 'view'),
  layout: false,
  viewExt: 'html',
  cache: false,
  debug: false
});
const routerNames = {
  playVideo: 'play-video',
  Photo3D: '3d-photo',
  webRTC: 'webRTC',
  setCode: 'set-code'
}
const getRouterPath = name => `/${name}`;
router.get(getRouterPath(routerNames.playVideo), async (ctx, next) => {
  await ctx.render(routerNames.playVideo);
});
router.get(getRouterPath(routerNames.Photo3D), async (ctx, next) => {
  await ctx.render(routerNames.Photo3D);
});
router.get(getRouterPath(routerNames.webRTC), async (ctx, next) => {
  await ctx.render(routerNames.webRTC);
});
router.get(getRouterPath(routerNames.setCode), async (ctx, next) => {
  await ctx.render(routerNames.setCode);
});
router.post('/set-code-post', async (ctx, next) => {
  console.log('ctx: ', ctx.request.body);
  const minPath = path.resolve(__dirname, `webpack/test-min.js`);
  fs.writeFileSync(path.resolve(__dirname, `webpack/test.js`), ctx.request.body.code, { 'flag': 'w' });
  fs.existsSync(minPath) && fs.unlinkSync(minPath);
  await require('./webpack')();
  ctx.body = fs.readFileSync(minPath, 'utf8');
});
app.use(router.routes());
const webServer = require('http').createServer(app.callback());
require('./chatserver')(webServer);