///////////////////////////////////////////////////
// Set these variables according to your project.
///////////////////////////////////////////////////

const BUCKET = 'my-static-assets';
const CACHE_STRATEGY = 'public, max-age=31536000';
const QUALITY = 60;
const ALPHAQUALITY = 80;

const path = require('path');
const AWS = require('aws-sdk');
const axios = require('axios');

const S3 = new AWS.S3({ signatureVersion: 'v4' })

const Sharp = require('sharp');

async function getS3Resource(key) {
  try {
    const resource = await S3.getObject({ Bucket: BUCKET, Key: key }).promise()
    return resource;
  } catch (error) {
    if (error.code !== 'NoSuchKey') { console.error(error); }
  }
  return null;
}


exports.handler = async (event, _, callback) => {
  const { request, response } = event.Records[0].cf;
  const { headers } = request;
  const { uri } = request;

  const acceptHeader = headers.accept ? headers.accept[0].value : '';
  const shouldServeWebp = acceptHeader.includes("image/webp");

  if (path.extname(uri).match(/(\.jpg|\.png|\.jpeg)$/g) && shouldServeWebp) {
    // We should only consider conversion if the source image exists.
    if (response.status === "200") {
      const s3key = uri.substring(1).replace(/%20/g, ' ');

      const existingWebp = await getS3Resource(s3key);

      if (existingWebp) {
        response.status = 200
        response.body = existingWebp.Body.toString('base64')
        response.bodyEncoding = 'base64'
        response.headers['content-type'] = [{ key: 'Content-Type', value: 'image/webp' }];
        response.headers['cache-control'] = [{ key: 'Cache-Control', value: CACHE_STRATEGY }];
      } else {
        const host = request.origin.custom.domainName;
        let requestHost = headers.host[0].value;
        const protocol = request.origin.custom.protocol;
        const originImageUrl = `${protocol}://${host}${uri}`;
        let sharpImageBuffer = null;

        try {
          const imageBody = (await axios({ url: originImageUrl, headers: { "Host": requestHost }, responseType: "arraybuffer" })).data;
  
          if (imageBody) {
            sharpImageBuffer = await Sharp(imageBody)
            .webp({ quality: +QUALITY, alphaQuality: +ALPHAQUALITY })
            .toBuffer();
  
            await S3.putObject({
              Body: sharpImageBuffer,
              Bucket: BUCKET,
              ContentType: 'image/webp',
              CacheControl: 'max-age=31536000',
              Key: s3key,
              StorageClass: 'STANDARD',
              ACL: 'public-read'
            }).promise();
          }
  
          if (sharpImageBuffer) {
            response.status = 200
            response.body = sharpImageBuffer.toString('base64')
            response.bodyEncoding = 'base64'
            response.headers['content-type'] = [{ key: 'Content-Type', value: 'image/webp' }]
            response.headers['cache-control'] = [{ key: 'Cache-Control', value: CACHE_STRATEGY }]
          }
        } catch (error) {
          console.log(error);
        }
      }
    }
  }
  response.headers['cloudfront-webp-version'] = [{ value: process.env.AWS_LAMBDA_FUNCTION_VERSION }];

  callback(null, response);
}