import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MODELS = 'anthropic.claude-opus-5,anthropic.claude-sonnet-5';

export class AnchorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const models: string = this.node.tryGetContext('bedrockModels') ?? process.env.BEDROCK_MODELS ?? DEFAULT_MODELS;

    const table = new dynamodb.TableV2(this, 'Workspaces', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const api = new lambda.Function(this, 'Api', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(root, 'dist/api')),
      memorySize: 1024,
      timeout: Duration.seconds(29),
      logGroup: new logs.LogGroup(this, 'ApiLogs', {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        TABLE_NAME: table.tableName,
        AI_PROVIDER: 'bedrock',
        BEDROCK_MODELS: models,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });
    table.grantReadWriteData(api);
    // Claude in Amazon Bedrock is served from the bedrock-mantle endpoint.
    api.addToRolePolicy(new iam.PolicyStatement({ actions: ['bedrock-mantle:CreateInference'], resources: ['*'] }));

    const httpApi = new HttpApi(this, 'HttpApi', {
      defaultIntegration: new HttpLambdaIntegration('ApiIntegration', api),
      createDefaultStage: false,
    });
    new HttpStage(this, 'DefaultStage', {
      httpApi,
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 25, burstLimit: 50 },
    });

    const site = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'Anchor web app and API',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(`${httpApi.apiId}.execute-api.${this.region}.${this.urlSuffix}`),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        },
      },
    });

    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(path.join(root, 'dist/web'))],
      destinationBucket: site,
      distribution,
      distributionPaths: ['/*'],
      // Hashed assets are safe to revalidate cheaply; this keeps index.html from ever going stale.
      cacheControl: [s3deploy.CacheControl.fromString('public, max-age=0, must-revalidate')],
      memoryLimit: 512,
    });

    new CfnOutput(this, 'AppUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'ApiEndpoint', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'BedrockModels', { value: models });
  }
}
