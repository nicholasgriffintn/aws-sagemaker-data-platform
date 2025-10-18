import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as glue from 'aws-cdk-lib/aws-glue';

export interface GlueStackProps extends StackProps {
  environmentName: string;
  componentName: string;
}

export class GlueStack extends Stack {
  public readonly rawDatabase: glue.CfnDatabase;
  public readonly rawDatabaseName: string;
  public readonly processedDatabase: glue.CfnDatabase;
  public readonly processedDatabaseName: string;

  constructor(scope: Construct, id: string, props: GlueStackProps) {
    super(scope, id, props);

    const catalogId = this.account;

    this.rawDatabaseName = `${props.componentName}_${props.environmentName}_raw`;
    this.processedDatabaseName = `${props.componentName}_${props.environmentName}_processed`;

    this.rawDatabase = new glue.CfnDatabase(this, 'RawGlueDatabase', {
      catalogId,
      databaseInput: {
        name: this.rawDatabaseName,
        description: 'Raw dataset database for Lake Formation access control',
      },
    });

    this.processedDatabase = new glue.CfnDatabase(
      this,
      'ProcessedGlueDatabase',
      {
        catalogId,
        databaseInput: {
          name: this.processedDatabaseName,
          description:
            'Processed dataset database for Lake Formation access control',
        },
      }
    );

    new CfnOutput(this, 'RawDatabaseNameOutput', {
      value: this.rawDatabase.ref,
      exportName: `${props.componentName}-${props.environmentName}-raw-database-name`,
    });

    new CfnOutput(this, 'ProcessedDatabaseNameOutput', {
      value: this.processedDatabase.ref,
      exportName: `${props.componentName}-${props.environmentName}-processed-database-name`,
    });
  }
}
