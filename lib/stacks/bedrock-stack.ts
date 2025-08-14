import { Construct } from 'constructs';
import {
	CfnOutput,
	aws_bedrock as bedrock,
	aws_iam as iam,
	aws_s3 as s3,
	aws_opensearchserverless as opensearch,
	Stack
} from 'aws-cdk-lib';

export interface BedrockStackProps {
	environmentName: string;
	projectBucket: s3.IBucket;
	enableKnowledgeBase: boolean;
	enableGuardrails: boolean;
}

export class BedrockStack extends Stack {
	public readonly knowledgeBase?: bedrock.CfnKnowledgeBase;
	public readonly guardrail?: bedrock.CfnGuardrail;
	public readonly bedrockRole: iam.Role;

	constructor(scope: Construct, id: string, props: BedrockStackProps) {
		super(scope, id);

		this.bedrockRole = new iam.Role(this, 'BedrockServiceRole', {
			assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
			description: 'Service role for Amazon Bedrock operations',
		});

		props.projectBucket.grantReadWrite(this.bedrockRole);

		this.bedrockRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: [
				'bedrock:InvokeModel',
				'bedrock:InvokeModelWithResponseStream',
				'bedrock:ListFoundationModels',
				'bedrock:GetFoundationModel',
			],
			resources: [
				`arn:aws:bedrock:${this.region}::foundation-model/*`,
			],
		}));

		if (props.enableGuardrails) {
			this.guardrail = new bedrock.CfnGuardrail(this, 'BedrockGuardrail', {
				name: `${props.environmentName}-unified-studio-guardrail`,
				description: 'Guardrail for Unified Studio generative AI applications',
				blockedInputMessaging: 'This input is not allowed by our content policy.',
				blockedOutputsMessaging: 'This output was blocked by our content policy.',
				contentPolicyConfig: {
					filtersConfig: [
						{
							type: 'SEXUAL',
							inputStrength: 'HIGH',
							outputStrength: 'HIGH',
						},
						{
							type: 'VIOLENCE',
							inputStrength: 'HIGH',
							outputStrength: 'HIGH',
						},
						{
							type: 'HATE',
							inputStrength: 'HIGH',
							outputStrength: 'HIGH',
						},
						{
							type: 'INSULTS',
							inputStrength: 'MEDIUM',
							outputStrength: 'MEDIUM',
						},
						{
							type: 'MISCONDUCT',
							inputStrength: 'HIGH',
							outputStrength: 'HIGH',
						},
						{
							type: 'PROMPT_ATTACK',
							inputStrength: 'HIGH',
							outputStrength: 'NONE',
						},
					],
				},
				topicPolicyConfig: {
					topicsConfig: [
						{
							name: 'Personal Information',
							definition: 'Topics related to personal identifiable information, social security numbers, or private data.',
							examples: [
								'What is my social security number?',
								'Can you store my personal information?',
							],
							type: 'DENY',
						},
					],
				},
			});
		}

		if (props.enableKnowledgeBase) {
			const vectorCollection = new opensearch.CfnCollection(this, 'VectorCollection', {
				name: `${props.environmentName}-kb-vectors`,
				description: 'Vector collection for Bedrock Knowledge Base',
				type: 'VECTORSEARCH',
			});

			new opensearch.CfnSecurityPolicy(this, 'VectorCollectionSecurityPolicy', {
				name: `${props.environmentName}-kb-vectors-security`,
				type: 'encryption',
				policy: JSON.stringify({
					Rules: [
						{
							ResourceType: 'collection',
							Resource: [`collection/${vectorCollection.name}`],
						},
					],
					AWSOwnedKey: true,
				}),
			});

			new opensearch.CfnSecurityPolicy(this, 'VectorCollectionNetworkPolicy', {
				name: `${props.environmentName}-kb-vectors-network`,
				type: 'network',
				policy: JSON.stringify([
					{
						Rules: [
							{
								ResourceType: 'collection',
								Resource: [`collection/${vectorCollection.name}`],
							},
						],
						AllowFromPublic: true,
					},
				]),
			});

			this.bedrockRole.addToPolicy(new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'aoss:APIAccessAll',
				],
				resources: [vectorCollection.attrArn],
			}));

			this.bedrockRole.addToPolicy(new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'bedrock:InvokeModel',
				],
				resources: [
					`arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v1`,
					`arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
				],
			}));

			this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
				name: `${props.environmentName}-unified-studio-kb`,
				description: 'Knowledge base for Unified Studio RAG applications',
				roleArn: this.bedrockRole.roleArn,
				knowledgeBaseConfiguration: {
					type: 'VECTOR',
					vectorKnowledgeBaseConfiguration: {
						embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
					},
				},
				storageConfiguration: {
					type: 'OPENSEARCH_SERVERLESS',
					opensearchServerlessConfiguration: {
						collectionArn: vectorCollection.attrArn,
						vectorIndexName: 'unified-studio-index',
						fieldMapping: {
							vectorField: 'vector',
							textField: 'text',
							metadataField: 'metadata',
						},
					},
				},
			});

			const dataSource = new bedrock.CfnDataSource(this, 'KnowledgeBaseDataSource', {
				name: `${props.environmentName}-s3-data-source`,
				description: 'S3 data source for knowledge base',
				knowledgeBaseId: this.knowledgeBase.attrKnowledgeBaseId,
				dataSourceConfiguration: {
					type: 'S3',
					s3Configuration: {
						bucketArn: props.projectBucket.bucketArn,
						inclusionPrefixes: ['knowledge-base/'],
					},
				},
				dataDeletionPolicy: 'RETAIN',
			});

			new CfnOutput(this, 'BedrockKnowledgeBaseId', {
				value: this.knowledgeBase.attrKnowledgeBaseId,
				description: 'Bedrock Knowledge Base ID',
			});

			new CfnOutput(this, 'BedrockDataSourceId', {
				value: dataSource.attrDataSourceId,
				description: 'Bedrock Knowledge Base Data Source ID',
			});
		}

		new CfnOutput(this, 'BedrockRoleArn', {
			value: this.bedrockRole.roleArn,
			description: 'Bedrock service role ARN',
		});

		if (this.guardrail) {
			new CfnOutput(this, 'BedrockGuardrailId', {
				value: this.guardrail.attrGuardrailId,
				description: 'Bedrock Guardrail ID',
			});

			new CfnOutput(this, 'BedrockGuardrailArn', {
				value: this.guardrail.attrGuardrailArn,
				description: 'Bedrock Guardrail ARN',
			});
		}
	}
}
