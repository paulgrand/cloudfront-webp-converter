#!/usr/bin/env bash

###########################################
# SET THESE VARIABLES ACCORDINGLY:
###########################################
# This is just an S3 bucket where we upload function bundles,
# the bucket shouldn't be public.
DIST_BUCKET="my-dist-bucket"

# This is a lambda function which you'll (for now) need to
# create manually, make sure it has an IAM role with appropriate
# permissions (S3/CloudWatch) and trust relationships.
FUNCTION_NAME="pauls-webp-converter"

[ -z $1 ] && echo "Numeric build number required as param" && exit 1

echo "Removing existing node_modules folder"
rm -rf node_modules

echo "Running npm ci (via Docker to ensure compatibility)"
# If you run into any docker-related issues, try removing the
# --platform linux/amd64 flag below.
docker run -v $(pwd):/app -w/app --platform linux/amd64 node:16 npm ci
[ $? -ne 0 ] && echo "Failed to run npm ci" && exit 1

echo "Zipping up code bundle"
zip -qr build-artifact.zip .
echo "Copying build-artifact.zip to s3://${DIST_BUCKET}/webp-converter/$1/build-artifact.zip"
aws s3 cp ./build-artifact.zip "s3://${DIST_BUCKET}/webp-converter/$1/"
[ $? -ne 0 ] && echo "Failed to upload code artifact" && exit 1

echo "Deleting local build-artifact.zip"
rm -f ./build-artifact.zip

echo "Updating function code for (us-east-1) ${FUNCTION_NAME}"
functionArn=$(aws lambda update-function-code \
  --region us-east-1 \
  --function-name $FUNCTION_NAME \
  --s3-bucket $DIST_BUCKET \
  --s3-key "webp-converter/$1/build-artifact.zip" \
  --publish \
  --query 'FunctionArn')

[ $? -ne 0 ] && echo "Failed to upload code & publish new version,\
 check error messages for output." && exit 1

echo "Successfully published new function version."
echo "Please update any applicable CloudFront behaviours to use function arn:"
echo ${functionArn//\"/}