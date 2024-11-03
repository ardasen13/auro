const express = require('express');
const proxy = require('express-http-proxy');
const app = express();
const bodyParser = require('body-parser');
const targetUrl = 'https://api.openai.com';
const openaiKey = process.env.OPENAI_KEY;
const proxyKey = process.env.PROXY_KEY; // Your secret proxy key
const port = 7860;
const baseUrl = getExternalUrl(process.env.SPACE_ID);
const rateLimit = require('express-rate-limit');
const requestIp = require('request-ip');
app.use(bodyParser.json({ limit: '50mb' }));

app.set('trust proxy', 1);

//app.use(requestIp.mw());
// Middleware to log requester's IP address
//function logIPAddress(req, res, next) {
//  console.log("Requester's IP address:", req.ip);
//next();
//}

// Apply the middleware to all requests
//app.use(logIPAddress);

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  keyGenerator: (req, res) => {
    return req.ip // IP address from requestIp.mw(), as opposed to req.ip
  },
  handler: function (req, res, next) {
    res.status(429).json({
      message: "Too many requests. Please try again later. You can retry after 15 minutes.",
    });
  },
});

// Apply the rate limiter to all requests
app.use(limiter);

// Middleware to authenticate requests with the proxy key and check the model
function authenticateProxyKeyAndModel(req, res, next) {
  const providedKey = req.headers['auro']; // Assuming the key is sent in the 'x-proxy-key' header
  const requestedModel = req.body.model;

  // List of allowed models
  const allowedModels = ['gpt-3.5-turbo', 'text-moderation-latest', 'gpt-3.5-turbo-1106', 'gpt-3.5-turbo-0125'];

  if (providedKey && providedKey === proxyKey && allowedModels.includes(requestedModel)) {
    // If the provided key matches the expected key and the requested model is allowed, allow the request to proceed
    next();
  } else {
    // If the key is missing or incorrect, or the model is not allowed, reject the request with an error response
    res.status(401).json({ error: 'Unauthorized or invalid model' });
  }
}


app.use('/api', authenticateProxyKeyAndModel, proxy(targetUrl, {
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    // Modify the request headers if necessary
    proxyReqOpts.headers['Authorization'] = 'Bearer ' + openaiKey;
    return proxyReqOpts;
  },
}));

app.get("/", (req, res) => {
  // res.send(`This is your OpenAI Reverse Proxy URL: ${baseUrl}`);
});

function getExternalUrl(spaceId) {
  try {
    const [username, spacename] = spaceId.split("/");
    return `https://${username}-${spacename.replace(/_/g, "-")}.hf.space/api/v1`;
  } catch (e) {
    return "";
  }
}

app.listen(port, () => {
  console.log(`Reverse proxy server running on ${baseUrl}`);
});