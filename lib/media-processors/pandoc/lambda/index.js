const fs = require("fs");
const path = require("path");
const { execFile } = require("node:child_process");
const { pipeline } = require("stream");
const { promisify } = require("util");

const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");

const s3 = new S3Client({ region: process.env.AWS_REGION });
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

const pipelineAsync = promisify(pipeline);
const execFileAsync = promisify(execFile);

exports.handler = async (event) => {
  const {
    SQS_QUEUE_MAX_RECEIVE_COUNT,
    BUCKET_NAME,
    EVENT_BUS_NAME,
    EVENT_SOURCE,
  } = process.env;
  const record = event.Records[0];
  const receiveCount = Number(record.attributes.ApproximateReceiveCount);
  const maxReceiveCount = Number(SQS_QUEUE_MAX_RECEIVE_COUNT);
  const isLastReceive = receiveCount === maxReceiveCount;
  const { inodeId, inodeS3Key, fileName, fileExt, devAppUrl } = JSON.parse(
    record.body
  );

  const resultDetail = {
    inodeId,
    inodeS3Key,
    devAppUrl,
  };

  const tmpId = crypto.randomUUID();
  const inputPath = `/tmp/${tmpId}.${fileExt}`;
  const outputPath = `/tmp/${tmpId}.html`;

  try {
    const s3Object = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: inodeS3Key })
    );

    const writeStream = fs.createWriteStream(inputPath);
    await pipelineAsync(s3Object.Body, writeStream);

    await execFileAsync("/opt/bin/pandoc", [
      inputPath,
      "-o",
      outputPath,
      "--standalone",
      "--embed-resources",
      "--include-in-header",
      path.join(__dirname, "header.html"),
      "--css",
      path.join(__dirname, "style.css"),
    ]);

    const outputBuffer = fs.readFileSync(outputPath);

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${inodeS3Key}/preview.html`,
        Body: outputBuffer,
        ContentType: "text/html",
        CacheControl: "public, max-age=31536000, immutable",
        ContentDisposition: `inline; filename*=UTF-8''${fileName}`,
      })
    );

    resultDetail.status = "COMPLETE";
  } catch (error) {
    resultDetail.status = "ERROR";
    console.error(error);
    throw error;
  } finally {
    if (resultDetail.status !== "ERROR" || isLastReceive) {
      const event = {
        Source: EVENT_SOURCE,
        DetailType: "PandocProcessorStatus",
        Detail: JSON.stringify(resultDetail),
        EventBusName: EVENT_BUS_NAME,
      };
      await eventBridge.send(new PutEventsCommand({ Entries: [event] }));
    }
  }
};
