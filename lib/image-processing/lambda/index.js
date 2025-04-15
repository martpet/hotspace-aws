const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const exifReader = require("exif-reader");
const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");
const { exit } = require("process");

const s3 = new S3Client({ region: process.env.AWS_REGION });
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const {
    BUCKET_NAME,
    EVENT_BUS_NAME,
    IMAGE_PROCESSING_EVENT_SOURCE,
    SQS_QUEUE_MAX_RECEIVE_COUNT,
  } = process.env;
  const record = event.Records[0];
  const receiveCount = Number(record.attributes.ApproximateReceiveCount);
  const maxReceiveCount = Number(SQS_QUEUE_MAX_RECEIVE_COUNT);
  const isLastReceive = receiveCount === maxReceiveCount;
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
        .rotate()
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

    if (metadata.exif) {
      const exif = exifReader(metadata.exif);
      resultDetail.exif = {
        Image: {
          Make: exif.Image.Make,
          Model: exif.Image.Model,
        },
        Photo: {
          DateTimeOriginal: exif.Photo.DateTimeOriginal,
          OffsetTimeOriginal: exif.Photo.OffsetTimeOriginal,
        },
        GPSInfo: {
          GPSLatitudeRef: exif.GPSInfo.GPSLatitudeRef,
          GPSLatitude: exif.GPSInfo.GPSLatitude,
          GPSLongitudeRef: exif.GPSInfo.GPSLongitudeRef,
          GPSLongitude: exif.GPSInfo.GPSLongitude,
          GPSAltitudeRef: exif.GPSInfo.GPSAltitudeRef,
          GPSAltitude: exif.GPSInfo.GPSAltitude,
          GPSSpeedRef: exif.GPSInfo.GPSSpeedRef,
          GPSSpeed: exif.GPSInfo.GPSSpeed,
          GPSImgDirectionRef: exif.GPSInfo.GPSImgDirectionRef,
          GPSImgDirection: exif.GPSInfo.GPSImgDirection,
          GPSDestBearingRef: exif.GPSInfo.GPSDestBearingRef,
          GPSDestBearing: exif.GPSInfo.GPSDestBearing,
          GPSHPositioningError: exif.GPSInfo.GPSHPositioningError,
        },
      };
    }
  } catch (error) {
    resultDetail.status = "ERROR";
    console.error("Error processing image:", error);
    throw error;
  } finally {
    if (resultDetail.status !== "ERROR" || isLastReceive) {
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
