import { Duration } from 'aws-cdk-lib';
import {
  Dashboard,
  GraphWidget,
  LogQueryWidget,
  Metric,
  Row,
  SingleValueWidget,
  TextWidget,
} from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface MLDashboardProps {
  componentName: string;
  environmentName: string;
  pipelineName: string;
  endpointName: string;
  lambdaFunctionName?: string;
  apiName?: string;
}

/**
 * CloudWatch Dashboard for ML Pipeline observability.
 *
 * Includes:
 * - SageMaker endpoint metrics (latency, invocations, errors)
 * - Lambda function metrics
 * - API Gateway metrics
 * - Log insights
 */
export class MLDashboard extends Construct {
  public readonly dashboard: Dashboard;

  constructor(scope: Construct, id: string, props: MLDashboardProps) {
    super(scope, id);

    const dashboardName = `${props.componentName}-${props.environmentName}-${props.pipelineName}-dashboard`;

    this.dashboard = new Dashboard(this, 'Dashboard', {
      dashboardName,
    });

    // Header
    this.dashboard.addWidgets(
      new TextWidget({
        markdown: `# ${props.pipelineName.toUpperCase()} ML Pipeline Dashboard\n\nReal-time monitoring for the ${
          props.pipelineName
        } ML pipeline in ${props.environmentName} environment.`,
        width: 24,
        height: 2,
      })
    );

    // SageMaker Endpoint Metrics
    const endpointDimensions = {
      EndpointName: props.endpointName,
      VariantName: 'primary',
    };

    this.dashboard.addWidgets(
      new TextWidget({
        markdown: '## SageMaker Endpoint Metrics',
        width: 24,
        height: 1,
      })
    );

    // Single value widgets for key metrics
    this.dashboard.addWidgets(
      new Row(
        new SingleValueWidget({
          title: 'Total Invocations (1h)',
          metrics: [
            new Metric({
              namespace: 'AWS/SageMaker',
              metricName: 'Invocations',
              dimensionsMap: endpointDimensions,
              statistic: 'Sum',
              period: Duration.hours(1),
            }),
          ],
          width: 6,
          height: 4,
        }),
        new SingleValueWidget({
          title: 'Avg Model Latency (ms)',
          metrics: [
            new Metric({
              namespace: 'AWS/SageMaker',
              metricName: 'ModelLatency',
              dimensionsMap: endpointDimensions,
              statistic: 'Average',
              period: Duration.minutes(5),
            }),
          ],
          width: 6,
          height: 4,
        }),
        new SingleValueWidget({
          title: '4XX Errors (1h)',
          metrics: [
            new Metric({
              namespace: 'AWS/SageMaker',
              metricName: 'Invocation4XXErrors',
              dimensionsMap: endpointDimensions,
              statistic: 'Sum',
              period: Duration.hours(1),
            }),
          ],
          width: 6,
          height: 4,
        }),
        new SingleValueWidget({
          title: '5XX Errors (1h)',
          metrics: [
            new Metric({
              namespace: 'AWS/SageMaker',
              metricName: 'Invocation5XXErrors',
              dimensionsMap: endpointDimensions,
              statistic: 'Sum',
              period: Duration.hours(1),
            }),
          ],
          width: 6,
          height: 4,
        })
      )
    );

    // Endpoint metrics graphs
    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'Invocations Over Time',
        left: [
          new Metric({
            namespace: 'AWS/SageMaker',
            metricName: 'Invocations',
            dimensionsMap: endpointDimensions,
            statistic: 'Sum',
            period: Duration.minutes(1),
          }),
        ],
        width: 12,
        height: 6,
      }),
      new GraphWidget({
        title: 'Model Latency (p50, p90, p99)',
        left: [
          new Metric({
            namespace: 'AWS/SageMaker',
            metricName: 'ModelLatency',
            dimensionsMap: endpointDimensions,
            statistic: 'p50',
            period: Duration.minutes(1),
            label: 'p50',
          }),
          new Metric({
            namespace: 'AWS/SageMaker',
            metricName: 'ModelLatency',
            dimensionsMap: endpointDimensions,
            statistic: 'p90',
            period: Duration.minutes(1),
            label: 'p90',
          }),
          new Metric({
            namespace: 'AWS/SageMaker',
            metricName: 'ModelLatency',
            dimensionsMap: endpointDimensions,
            statistic: 'p99',
            period: Duration.minutes(1),
            label: 'p99',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Error rate graph
    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'Error Rates',
        left: [
          new Metric({
            namespace: 'AWS/SageMaker',
            metricName: 'Invocation4XXErrors',
            dimensionsMap: endpointDimensions,
            statistic: 'Sum',
            period: Duration.minutes(1),
            label: '4XX Errors',
          }),
          new Metric({
            namespace: 'AWS/SageMaker',
            metricName: 'Invocation5XXErrors',
            dimensionsMap: endpointDimensions,
            statistic: 'Sum',
            period: Duration.minutes(1),
            label: '5XX Errors',
          }),
        ],
        width: 12,
        height: 6,
      }),
      new GraphWidget({
        title: 'Overhead Latency',
        left: [
          new Metric({
            namespace: 'AWS/SageMaker',
            metricName: 'OverheadLatency',
            dimensionsMap: endpointDimensions,
            statistic: 'Average',
            period: Duration.minutes(1),
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Lambda Metrics (if provided)
    if (props.lambdaFunctionName) {
      this.dashboard.addWidgets(
        new TextWidget({
          markdown: '## Lambda Function Metrics',
          width: 24,
          height: 1,
        })
      );

      const lambdaDimensions = {
        FunctionName: props.lambdaFunctionName,
      };

      this.dashboard.addWidgets(
        new GraphWidget({
          title: 'Lambda Invocations & Errors',
          left: [
            new Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Invocations',
              dimensionsMap: lambdaDimensions,
              statistic: 'Sum',
              period: Duration.minutes(1),
            }),
          ],
          right: [
            new Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Errors',
              dimensionsMap: lambdaDimensions,
              statistic: 'Sum',
              period: Duration.minutes(1),
            }),
          ],
          width: 12,
          height: 6,
        }),
        new GraphWidget({
          title: 'Lambda Duration',
          left: [
            new Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Duration',
              dimensionsMap: lambdaDimensions,
              statistic: 'Average',
              period: Duration.minutes(1),
              label: 'Average',
            }),
            new Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Duration',
              dimensionsMap: lambdaDimensions,
              statistic: 'p99',
              period: Duration.minutes(1),
              label: 'p99',
            }),
          ],
          width: 12,
          height: 6,
        })
      );

      // Lambda logs insights
      this.dashboard.addWidgets(
        new LogQueryWidget({
          title: 'Lambda Error Logs',
          logGroupNames: [`/aws/lambda/${props.lambdaFunctionName}`],
          queryLines: [
            'fields @timestamp, @message',
            'filter @message like /ERROR|Exception|error/',
            'sort @timestamp desc',
            'limit 20',
          ],
          width: 24,
          height: 6,
        })
      );
    }

    // API Gateway Metrics (if provided)
    if (props.apiName) {
      this.dashboard.addWidgets(
        new TextWidget({
          markdown: '## API Gateway Metrics',
          width: 24,
          height: 1,
        })
      );

      const apiDimensions = {
        ApiName: props.apiName,
      };

      this.dashboard.addWidgets(
        new GraphWidget({
          title: 'API Requests',
          left: [
            new Metric({
              namespace: 'AWS/ApiGateway',
              metricName: 'Count',
              dimensionsMap: apiDimensions,
              statistic: 'Sum',
              period: Duration.minutes(1),
            }),
          ],
          width: 8,
          height: 6,
        }),
        new GraphWidget({
          title: 'API Latency',
          left: [
            new Metric({
              namespace: 'AWS/ApiGateway',
              metricName: 'Latency',
              dimensionsMap: apiDimensions,
              statistic: 'Average',
              period: Duration.minutes(1),
            }),
          ],
          width: 8,
          height: 6,
        }),
        new GraphWidget({
          title: 'API Errors',
          left: [
            new Metric({
              namespace: 'AWS/ApiGateway',
              metricName: '4XXError',
              dimensionsMap: apiDimensions,
              statistic: 'Sum',
              period: Duration.minutes(1),
              label: '4XX',
            }),
            new Metric({
              namespace: 'AWS/ApiGateway',
              metricName: '5XXError',
              dimensionsMap: apiDimensions,
              statistic: 'Sum',
              period: Duration.minutes(1),
              label: '5XX',
            }),
          ],
          width: 8,
          height: 6,
        })
      );
    }
  }
}
