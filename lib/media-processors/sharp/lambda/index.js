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

const s3 = new S3Client({ region: process.env.AWS_REGION });
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

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
  const { inodeId, inodeS3Key, fileName, devAppUrl } = JSON.parse(record.body);

  const resultDetail = {
    inodeId,
    inodeS3Key,
    devAppUrl,
  };

  try {
    const s3Object = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: inodeS3Key })
    );

    const chunks = [];
    for await (const chunk of s3Object.Body) chunks.push(chunk);
    const inputBuffer = Buffer.concat(chunks);

    const sharpOpt = {
      limitInputPixels: 900_000_000,
    };

    const thumbs = [
      {
        outputFileName: "preview.jpeg",
        height: 500,
        quality: 90,
      },
      {
        outputFileName: "preview_sm.jpeg",
        height: 150,
        quality: 80,
      },
    ];

    for ({ outputFileName, height, quality } of thumbs) {
      const resizedBuffer = await sharp(inputBuffer, sharpOpt)
        .rotate()
        .resize({ height, withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `${inodeS3Key}/${outputFileName}`,
          Body: resizedBuffer,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
          ContentDisposition: `inline; filename*=UTF-8''${fileName}`,
        })
      );
    }

    const metadata = await sharp(inputBuffer, sharpOpt).metadata();

    resultDetail.status = "COMPLETE";
    resultDetail.width = metadata.width;
    resultDetail.height = metadata.height;

    if (metadata.exif) {
      const exif = exifReader(metadata.exif);
      const dateTimeOriginal = exif.Photo?.DateTimeOriginal;
      const offsetTimeOriginal = exif.Photo?.OffsetTimeOriginal;
      let fixedDateTimeOriginal = dateTimeOriginal;

      if (dateTimeOriginal && offsetTimeOriginal) {
        fixedDateTimeOriginal = new Date(
          dateTimeOriginal.toISOString().replace("Z", offsetTimeOriginal)
        );
      }
      resultDetail.exif = {
        Make: exif.Image?.Make,
        Model: exif.Image?.Model,
        DateTimeOriginal: fixedDateTimeOriginal,
        OffsetTimeOriginal: offsetTimeOriginal,
        GPSLatitude: exif.GPSInfo?.GPSLatitude,
        GPSLongitudeRef: exif.GPSInfo?.GPSLongitudeRef,
        GPSLongitude: exif.GPSInfo?.GPSLongitude,
        GPSAltitudeRef: exif.GPSInfo?.GPSAltitudeRef,
        GPSAltitude: exif.GPSInfo?.GPSAltitude,
        GPSSpeedRef: exif.GPSInfo?.GPSSpeedRef,
        GPSSpeed: exif.GPSInfo?.GPSSpeed,
        GPSImgDirectionRef: exif.GPSInfo?.GPSImgDirectionRef,
        GPSImgDirection: exif.GPSInfo?.GPSImgDirection,
        GPSDestBearingRef: exif.GPSInfo?.GPSDestBearingRef,
        GPSDestBearing: exif.GPSInfo?.GPSDestBearing,
        GPSHPositioningError: exif.GPSInfo?.GPSHPositioningError,
        GPSDateStamp: exif.GPSInfo?.GPSDateStamp,
        GPSTimeStamp: exif.GPSInfo?.GPSTimeStamp,
      };
    }
  } catch (error) {
    resultDetail.status = "ERROR";
    console.error(error);
    throw error;
  } finally {
    if (resultDetail.status !== "ERROR" || isLastReceive) {
      const event = {
        Source: EVENT_SOURCE,
        DetailType: "SharpProcessorStatus",
        Detail: JSON.stringify(resultDetail),
        EventBusName: EVENT_BUS_NAME,
      };
      await eventBridge.send(new PutEventsCommand({ Entries: [event] }));
    }
  }
};
