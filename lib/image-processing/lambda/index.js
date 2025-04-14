const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");

const MAX_SQS_RETRY_COUNT = 3;

const s3 = new S3Client({ region: process.env.AWS_REGION });
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const { BUCKET_NAME, EVENT_BUS_NAME, IMAGE_PROCESSING_EVENT_SOURCE } =
    process.env;
  const record = event.Records[0];
  const receiveCount = Number(record.attributes.ApproximateReceiveCount);
  const isLastRetry = receiveCount === MAX_SQS_RETRY_COUNT;

  const { inodeId, inodeS3Key, fileName, devAppUrl } = JSON.parse(record.body);

  const resultDetail = {
    inodeId,
    inodeS3Key,
    devAppUrl,
  };

  try {
    const getObjectOutput = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: inodeS3Key })
    );

    const chunks = [];
    for await (const chunk of getObjectOutput.Body) chunks.push(chunk);

    const imageBuffer = Buffer.concat(chunks);

    const sharpOpt = {
      limitInputPixels: 900_000_000,
    };

    const thumbs = [
      {
        thumbLabel: "md",
        height: 500,
        quality: 90,
      },
      {
        thumbLabel: "sm",
        height: 150,
        quality: 80,
      },
    ];

    for ({ thumbLabel, height, quality } of thumbs) {
      const resizedBuffer = await sharp(imageBuffer, sharpOpt)
        .resize({ height, withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      const encodedFileName = encodeURIComponent(fileName);

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `${inodeS3Key}/thumb_${thumbLabel}.jpeg`,
          Body: resizedBuffer,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
          ContentDisposition: `inline; filename*=UTF-8''${encodedFileName}`,
        })
      );
    }

    const metadata = await sharp(imageBuffer, sharpOpt).metadata();

    resultDetail.status = "COMPLETE";
    resultDetail.width = metadata.width;
    resultDetail.height = metadata.height;
  } catch (error) {
    resultDetail.status = "ERROR";
    console.error("Error processing image:", error);
    throw error;
  } finally {
    if (resultDetail.status !== "ERROR" || isLastRetry) {
      const event = {
        Source: IMAGE_PROCESSING_EVENT_SOURCE,
        DetailType: "ImageProcessedStatus",
        Detail: JSON.stringify(resultDetail),
        EventBusName: EVENT_BUS_NAME,
      };
      await eventBridge.send(new PutEventsCommand({ Entries: [event] }));
    }
  }
};
