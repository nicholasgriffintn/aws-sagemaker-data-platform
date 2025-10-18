import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lakeformation from 'aws-cdk-lib/aws-lakeformation';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { IRole } from 'aws-cdk-lib/aws-iam';
import * as glue from 'aws-cdk-lib/aws-glue';

export interface LakeFormationStackProps extends StackProps {
  environmentName: string;
  componentName: string;
  rawDataBucket: Bucket;
  processedDataBucket: Bucket;
  dataLakeAdmins: IRole[];
  pipelineRole: IRole;
  sagemakerExecutionRole: IRole;
  sagemakerJobRole: IRole;
  rawDatabase: glue.CfnDatabase;
  rawDatabaseName: string;
  processedDatabase: glue.CfnDatabase;
  processedDatabaseName: string;
}

interface PrincipalConfiguration {
  readonly id: string;
  readonly role: IRole;
  readonly databasePermissions: string[];
  readonly tablePermissions: string[];
}

export class LakeFormationStack extends Stack {
  constructor(scope: Construct, id: string, props: LakeFormationStackProps) {
    super(scope, id, props);

    const catalogId = this.account;
    const admins =
      props.dataLakeAdmins.length > 0
        ? props.dataLakeAdmins
        : [props.pipelineRole];

    const dataLakeSettings = new lakeformation.CfnDataLakeSettings(
      this,
      'DataLakeSettings',
      {
        admins: admins.map((role) => ({
          dataLakePrincipalIdentifier: role.roleArn,
        })),
        createDatabaseDefaultPermissions: [],
        createTableDefaultPermissions: [],
      }
    );

    const datasetConfigs = [
      {
        id: 'Raw',
        tagValue: 'raw',
        dataLocationArn: props.rawDataBucket.bucketArn,
        databaseName: props.rawDatabaseName,
        databaseResource: props.rawDatabase,
      },
      {
        id: 'Processed',
        tagValue: 'processed',
        dataLocationArn: props.processedDataBucket.bucketArn,
        databaseName: props.processedDatabaseName,
        databaseResource: props.processedDatabase,
      },
    ];

    const datasetTagValues = Array.from(
      new Set(datasetConfigs.map((dataset) => dataset.tagValue))
    );

    const datasetTag = new lakeformation.CfnTag(this, 'DatasetLfTag', {
      catalogId,
      tagKey: 'dataset',
      tagValues: datasetTagValues,
    });
    datasetTag.node.addDependency(dataLakeSettings);

    const databaseTagAssociations: Record<
      string,
      lakeformation.CfnTagAssociation
    > = {};

    for (const dataset of datasetConfigs) {
      if (!dataset.databaseName) {
        continue;
      }
      const association = new lakeformation.CfnTagAssociation(
        this,
        `${dataset.id}DatabaseDatasetTag`,
        {
          resource: {
            database: {
              catalogId,
              name: dataset.databaseName,
            },
          },
          lfTags: [
            {
              catalogId,
              tagKey: 'dataset',
              tagValues: [dataset.tagValue],
            },
          ],
        }
      );
      association.node.addDependency(datasetTag);
      if (dataset.databaseResource) {
        association.node.addDependency(dataset.databaseResource);
      }
      databaseTagAssociations[dataset.id] = association;
    }

    const dataLocations: Record<string, lakeformation.CfnResource> = {};

    for (const dataset of datasetConfigs) {
      const dataLocation = new lakeformation.CfnResource(
        this,
        `${dataset.id}DataLocation`,
        {
          resourceArn: dataset.dataLocationArn,
          useServiceLinkedRole: true,
          hybridAccessEnabled: false,
        }
      );
      dataLocation.node.addDependency(datasetTag);
      dataLocations[dataset.id] = dataLocation;
    }

    const principals: PrincipalConfiguration[] = [
      {
        id: 'Pipeline',
        role: props.pipelineRole,
        databasePermissions: ['ALL'],
        tablePermissions: ['ALL'],
      },
      {
        id: 'SagemakerJob',
        role: props.sagemakerJobRole,
        databasePermissions: ['DESCRIBE'],
        tablePermissions: ['SELECT', 'DESCRIBE'],
      },
      {
        id: 'StudioExecution',
        role: props.sagemakerExecutionRole,
        databasePermissions: ['DESCRIBE'],
        tablePermissions: ['SELECT', 'DESCRIBE'],
      },
    ];

    for (const principal of principals) {
      for (const dataset of datasetConfigs) {
        const dataLocationPermission =
          new lakeformation.CfnPrincipalPermissions(
            this,
            `${principal.id}${dataset.id}DataLocationAccess`,
            {
              principal: {
                dataLakePrincipalIdentifier: principal.role.roleArn,
              },
              permissions: ['DATA_LOCATION_ACCESS'],
              permissionsWithGrantOption: [],
              resource: {
                dataLocation: {
                  catalogId,
                  resourceArn: dataset.dataLocationArn,
                },
              },
            }
          );
        dataLocationPermission.node.addDependency(datasetTag);
        dataLocationPermission.node.addDependency(dataLocations[dataset.id]);

        const databasePermission = new lakeformation.CfnPrincipalPermissions(
          this,
          `${principal.id}${dataset.id}DatabaseTagPolicy`,
          {
            principal: {
              dataLakePrincipalIdentifier: principal.role.roleArn,
            },
            permissions: principal.databasePermissions,
            permissionsWithGrantOption: [],
            resource: {
              lfTagPolicy: {
                catalogId,
                resourceType: 'DATABASE',
                expression: [
                  {
                    tagKey: 'dataset',
                    tagValues: [dataset.tagValue],
                  },
                ],
              },
            },
          }
        );
        databasePermission.node.addDependency(datasetTag);
        const databaseAssociation = databaseTagAssociations[dataset.id];
        if (databaseAssociation) {
          databasePermission.node.addDependency(databaseAssociation);
        }

        const tablePermission = new lakeformation.CfnPrincipalPermissions(
          this,
          `${principal.id}${dataset.id}TableTagPolicy`,
          {
            principal: {
              dataLakePrincipalIdentifier: principal.role.roleArn,
            },
            permissions: principal.tablePermissions,
            permissionsWithGrantOption: [],
            resource: {
              lfTagPolicy: {
                catalogId,
                resourceType: 'TABLE',
                expression: [
                  {
                    tagKey: 'dataset',
                    tagValues: [dataset.tagValue],
                  },
                ],
              },
            },
          }
        );
        tablePermission.node.addDependency(datasetTag);
        if (databaseAssociation) {
          tablePermission.node.addDependency(databaseAssociation);
        }
      }
    }
  }
}
