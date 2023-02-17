# About
This tool is responsible for serving optimised (webp) images
on the fly.

e.g. User requests my-image.jpg
We serve my-image.jpg (but it'll actually be served as image/webp)
and will thus be much smaller.

NOTE: We ONLY serve webp images if the user's browser suggests
that they can accept it via an Accept header, e.g. (Accept: image/webp).

Once we've generated the image the first time,
we store it in S3 so that any subsequent requests can be served more quickly.
Be sure to add the "Accept" header to your CloudFront cache key.

# PREREQUISITES
1: Docker (we build the bundle in Docker to ensure compatibility with Lambda).
2: Create a blank NodeJS Lambda@EDGE function in us-east-1

# Getting started
1: Update "index.js" and change 
2: Update "deploy.sh" and change FUNCTION_NAME, DIST_BUCKET

# Deploying
The deploy script (./deploy.sh) creates a build artifact and
updates the relevant (whatcar-webp-converter) function in us-east-1.

Follow these steps after running this script:
1: Grab the function ARN which is output by the deploy script.
2: Update any applicable CloudFront behaviours, adding the copied
   ARN to the **Origin Response** Lambda@EDGE field.
   If you serve ALL content from your CloudFront distribution,
   add a behaviour for e.g. "*.jp?g".
   If you only serve images & assets from your CloudFront distribution,
   you can add this Lambda@EDGE function to your Default(*) behaviour.

# NOTES
Bear in mind there is likely to be some additional cost incurred by
deploying this converter. (Notably Lambda@EDGE invocation and S3 storage
and retrieval). In general, we've found that costs tend to stay around the same,
and on some larger sites costs can even decrease due to the reduction in data
transfer out of CloudFront.