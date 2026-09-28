import { App } from 'aws-cdk-lib';
import { AnchorStack } from './anchor-stack';

const app = new App();

new AnchorStack(app, 'AnchorStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'Anchor: the family co-pilot for Gen Alpha (AWS Zero to Shipped 2026)',
});
