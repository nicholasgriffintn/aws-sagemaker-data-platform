import { Construct } from 'constructs';
import {
	CfnOutput,
	aws_athena as athena,
	aws_s3 as s3,
	aws_glue as glue,
	Stack
} from 'aws-cdk-lib';

export interface AthenaStackProps {
	environmentName: string;
	queryResultsBucket: s3.IBucket;
	glueDatabase: glue.CfnDatabase;
}

export class AthenaStack extends Stack {
	public readonly workGroup: athena.CfnWorkGroup;
	public readonly dataSource: athena.CfnDataCatalog;

	constructor(scope: Construct, id: string, props: AthenaStackProps) {
		super(scope, id);

		this.workGroup = new athena.CfnWorkGroup(this, 'AthenaWorkGroup', {
			name: `${props.environmentName}-unified-studio-workgroup`,
			description: `Athena workgroup for ${props.environmentName} Unified Studio queries`,
			state: 'ENABLED',
			workGroupConfiguration: {
				resultConfiguration: {
					outputLocation: `s3://${props.queryResultsBucket.bucketName}/athena-results/`,
					encryptionConfiguration: {
						encryptionOption: 'SSE_S3',
					},
				},
				enforceWorkGroupConfiguration: true,
				bytesScannedCutoffPerQuery: 10 * 1024 * 1024 * 1024, // 10GB limit
				engineVersion: {
					selectedEngineVersion: 'Athena engine version 3',
				},
			},
		});

		this.dataSource = new athena.CfnDataCatalog(this, 'GlueDataCatalog', {
			name: `${props.environmentName}-glue-catalog`,
			description: 'Glue Data Catalog integration for Athena',
			type: 'GLUE',
			parameters: {
				'catalog-id': this.account,
			},
		});

		const sampleQueries = [
			{
				name: 'ListTables',
				description: 'List all tables in the data catalog',
				query: `SHOW TABLES IN "${props.glueDatabase.ref}";`,
			},
			{
				name: 'SampleDataExploration',
				description: 'Sample query to explore data structure',
				query: `-- Sample data exploration query
-- Replace 'your_table_name' with actual table name from catalog
SELECT * FROM "${props.glueDatabase.ref}"."your_table_name" LIMIT 10;`,
			},
			{
				name: 'DataQualityCheck',
				description: 'Basic data quality checks',
				query: `-- Data quality check template
-- Replace 'your_table_name' with actual table name
SELECT 
    COUNT(*) as total_rows,
    COUNT(DISTINCT column_name) as unique_values,
    SUM(CASE WHEN column_name IS NULL THEN 1 ELSE 0 END) as null_count
FROM "${props.glueDatabase.ref}"."your_table_name";`,
			},
		];

		sampleQueries.forEach((queryConfig, index) => {
			new athena.CfnNamedQuery(this, `NamedQuery${index + 1}`, {
				name: `${props.environmentName}-${queryConfig.name}`,
				description: queryConfig.description,
				queryString: queryConfig.query,
				database: props.glueDatabase.ref,
				workGroup: this.workGroup.name,
			});
		});

		new CfnOutput(this, 'AthenaWorkGroup', {
			value: this.workGroup.name!,
			description: 'Athena WorkGroup for Unified Studio queries',
		});

		new CfnOutput(this, 'AthenaQueryResultsLocation', {
			value: `s3://${props.queryResultsBucket.bucketName}/athena-results/`,
			description: 'S3 location for Athena query results',
		});

		new CfnOutput(this, 'GlueDataCatalogName', {
			value: this.dataSource.name!,
			description: 'Glue Data Catalog name for Athena integration',
		});
	}
}
