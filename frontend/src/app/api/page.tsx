'use client';

import { motion } from 'framer-motion';
import { Navigation } from '@/components/Navigation';
import { apiConfig, isConfigured } from '@/config/endpoints';
import { Code, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface EndpointDoc {
  method: string;
  path: string;
  description: string;
  requestBody: {
    field: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  responseFields: {
    field: string;
    type: string;
    description: string;
  }[];
  example: {
    request: object;
    response: object;
  };
}

const endpoints: EndpointDoc[] = [
  {
    method: 'POST',
    path: '/bucket',
    description:
      'Classify a user into an experiment bucket based on their features.',
    requestBody: [
      {
        field: 'user_id',
        type: 'string',
        required: true,
        description: 'Unique identifier for the user',
      },
    ],
    responseFields: [
      {
        field: 'user_id',
        type: 'string',
        description: 'The requested user ID',
      },
      {
        field: 'bucket',
        type: 'string',
        description: 'Assigned bucket (e.g., high_value, growth, standard)',
      },
      {
        field: 'confidence',
        type: 'number',
        description: 'Model confidence score (0-1)',
      },
      {
        field: 'experiment_assignment',
        type: 'object',
        description: 'Experiment type and variant assignment',
      },
      {
        field: 'features_used',
        type: 'object',
        description: 'Key features used for classification',
      },
    ],
    example: {
      request: { user_id: 'user_12345' },
      response: {
        user_id: 'user_12345',
        bucket: 'high_value',
        confidence: 0.87,
        experiment_assignment: { type: 'layout_test', variant: 'B' },
        features_used: { engagement_score: 0.82, total_spent: 245.5 },
      },
    },
  },
  {
    method: 'POST',
    path: '/recommend',
    description:
      'Get experiment recommendations based on a natural language goal.',
    requestBody: [
      {
        field: 'goal',
        type: 'string',
        required: true,
        description: 'Natural language description of the experiment goal',
      },
      {
        field: 'top_n',
        type: 'number',
        required: false,
        description: 'Number of recommendations to return (default: 5)',
      },
    ],
    responseFields: [
      { field: 'goal', type: 'string', description: 'The original goal text' },
      {
        field: 'parsed',
        type: 'object',
        description:
          'Structured parsing of the goal (segment, metric, time_focus)',
      },
      {
        field: 'recommendations',
        type: 'array',
        description: 'Ranked list of experiment recommendations',
      },
    ],
    example: {
      request: { goal: 'increase live news at 18:00 for 16-25s', top_n: 3 },
      response: {
        goal: 'increase live news at 18:00 for 16-25s',
        parsed: {
          segment: '16_25',
          metric: 'live_news_18_consumption',
          time_focus: 18,
        },
        recommendations: [
          {
            template_id: 'live_news_push_16_25',
            description: 'Push reminder for Live News at 18:00',
            predicted_uplift: 0.12,
          },
          {
            template_id: 'tv_pre_live_news_prompt',
            description: 'Pre-live news prompt on TV Home',
            predicted_uplift: 0.09,
          },
        ],
      },
    },
  },
];

export default function ApiPage() {
  const configured = isConfigured();

  return (
    <main className="min-h-screen bg-canvas">
      <Navigation />

      <div className="pt-24 pb-32">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-xl bg-violet/10 flex items-center justify-center">
                <Code className="w-7 h-7 text-violet" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">API Reference</h1>
                <p className="text-zinc-500">Complete API documentation</p>
              </div>
            </div>

            <p className="text-lg text-zinc-400 leading-relaxed">
              The ML Platform exposes two main API endpoints for user bucketing
              and experiment recommendations. Both endpoints are REST APIs
              backed by AWS Lambda and API Gateway.
            </p>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            <h2 className="text-xl font-bold text-white mb-4">Base URLs</h2>

            {configured ? (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-canvas-light border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-zinc-400">Bucketing API</span>
                  </div>
                  <code className="text-accent text-sm">
                    {apiConfig.bucketingApiUrl}
                  </code>
                </div>
                <div className="p-4 rounded-lg bg-canvas-light border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-zinc-400">
                      Recommender API
                    </span>
                  </div>
                  <code className="text-ember text-sm">
                    {apiConfig.recommenderApiUrl}
                  </code>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-amber-200 font-medium">Not Configured</p>
                    <p className="text-amber-200/70 text-sm">
                      API endpoints will be configured automatically when you
                      deploy the CDK stack. The URLs will be injected at build
                      time.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-12"
          >
            <h2 className="text-xl font-bold text-white mb-4">
              Authentication
            </h2>
            <div className="p-4 rounded-lg bg-canvas-light border border-white/5">
              <p className="text-zinc-400 text-sm">
                The APIs currently use API Gateway&apos;s default open access.
                For production use, configure authentication via API keys, IAM,
                or Cognito.
              </p>
            </div>
          </motion.section>

          {endpoints.map((endpoint, i) => (
            <motion.section
              key={endpoint.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-6">
                <span
                  className={`px-3 py-1 rounded-lg font-mono text-sm font-bold ${
                    endpoint.method === 'POST'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {endpoint.method}
                </span>
                <code className="text-xl text-white font-semibold">
                  {endpoint.path}
                </code>
              </div>

              <p className="text-zinc-400 mb-6">{endpoint.description}</p>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-accent" />
                  Request Body
                </h3>
                <div className="overflow-hidden rounded-lg border border-white/5">
                  <table className="w-full text-sm">
                    <thead className="bg-canvas-light">
                      <tr>
                        <th className="text-left px-4 py-2 text-zinc-400 font-medium">
                          Field
                        </th>
                        <th className="text-left px-4 py-2 text-zinc-400 font-medium">
                          Type
                        </th>
                        <th className="text-left px-4 py-2 text-zinc-400 font-medium">
                          Required
                        </th>
                        <th className="text-left px-4 py-2 text-zinc-400 font-medium">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoint.requestBody.map((field) => (
                        <tr
                          key={field.field}
                          className="border-t border-white/5"
                        >
                          <td className="px-4 py-2 font-mono text-accent">
                            {field.field}
                          </td>
                          <td className="px-4 py-2 text-zinc-500">
                            {field.type}
                          </td>
                          <td className="px-4 py-2">
                            {field.required ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                                Yes
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-zinc-500">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-zinc-400">
                            {field.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-accent" />
                  Response (200 OK)
                </h3>
                <div className="overflow-hidden rounded-lg border border-white/5">
                  <table className="w-full text-sm">
                    <thead className="bg-canvas-light">
                      <tr>
                        <th className="text-left px-4 py-2 text-zinc-400 font-medium">
                          Field
                        </th>
                        <th className="text-left px-4 py-2 text-zinc-400 font-medium">
                          Type
                        </th>
                        <th className="text-left px-4 py-2 text-zinc-400 font-medium">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoint.responseFields.map((field) => (
                        <tr
                          key={field.field}
                          className="border-t border-white/5"
                        >
                          <td className="px-4 py-2 font-mono text-accent">
                            {field.field}
                          </td>
                          <td className="px-4 py-2 text-zinc-500">
                            {field.type}
                          </td>
                          <td className="px-4 py-2 text-zinc-400">
                            {field.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-accent" />
                  Example
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="terminal">
                    <div className="terminal-header">
                      <div className="terminal-dot bg-red-500" />
                      <div className="terminal-dot bg-yellow-500" />
                      <div className="terminal-dot bg-green-500" />
                      <span className="ml-4 text-zinc-500 text-sm">
                        Request
                      </span>
                    </div>
                    <div className="terminal-content">
                      <pre className="!bg-transparent !border-0 !p-0 text-xs">
                        {JSON.stringify(endpoint.example.request, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div className="terminal">
                    <div className="terminal-header">
                      <div className="terminal-dot bg-red-500" />
                      <div className="terminal-dot bg-yellow-500" />
                      <div className="terminal-dot bg-green-500" />
                      <span className="ml-4 text-zinc-500 text-sm">
                        Response
                      </span>
                    </div>
                    <div className="terminal-content">
                      <pre className="!bg-transparent !border-0 !p-0 text-xs">
                        {JSON.stringify(endpoint.example.response, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          ))}

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-xl font-bold text-white mb-4">
              Error Responses
            </h2>

            <div className="space-y-3">
              {[
                {
                  code: 400,
                  message: 'Bad Request',
                  description: 'Missing or invalid request parameters',
                },
                {
                  code: 404,
                  message: 'Not Found',
                  description: 'User or resource not found',
                },
                {
                  code: 500,
                  message: 'Internal Server Error',
                  description: 'Server-side error',
                },
              ].map((error) => (
                <div
                  key={error.code}
                  className="p-4 rounded-lg border border-white/5"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-sm">
                      {error.code}
                    </span>
                    <span className="text-white font-medium">
                      {error.message}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">{error.description}</p>
                </div>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
