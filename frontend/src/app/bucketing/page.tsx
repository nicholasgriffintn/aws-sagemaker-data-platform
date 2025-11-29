'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import {
  Users,
  ArrowRight,
  Database,
  Cpu,
  Workflow,
  CheckCircle,
  Zap,
  Play,
} from 'lucide-react';

export default function BucketingPage() {
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
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
                <Users className="w-7 h-7 text-accent" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  User Bucketing Pipeline
                </h1>
                <p className="text-zinc-500">
                  Intelligent user classification for experiments
                </p>
              </div>
            </div>

            <p className="text-lg text-zinc-400 leading-relaxed">
              The User Bucketing Pipeline uses machine learning to classify
              users into experiment groups based on their features and behavior
              patterns. This enables intelligent A/B testing and personalized
              experiences.
            </p>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">How It Works</h2>

            <div className="space-y-4">
              {[
                {
                  step: 1,
                  title: 'User Request',
                  description:
                    'When a user visits your app, send their user_id to the bucketing API.',
                  icon: Users,
                },
                {
                  step: 2,
                  title: 'Feature Retrieval',
                  description:
                    'The system fetches user features from DynamoDB or SageMaker Feature Store.',
                  icon: Database,
                },
                {
                  step: 3,
                  title: 'ML Inference',
                  description:
                    'SageMaker endpoint runs the trained model to predict the optimal bucket.',
                  icon: Cpu,
                },
                {
                  step: 4,
                  title: 'Experiment Assignment',
                  description:
                    'User receives bucket assignment and experiment variant for A/B testing.',
                  icon: Workflow,
                },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="flex gap-4 p-4 rounded-xl bg-canvas-light border border-white/5"
                >
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <div className="text-xs text-accent mb-1">
                      Step {item.step}
                    </div>
                    <h3 className="text-white font-medium">{item.title}</h3>
                    <p className="text-sm text-zinc-500">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              User Features
            </h2>

            <p className="text-zinc-400 mb-6">
              The model uses the following features to classify users:
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  name: 'age',
                  type: 'number',
                  description: 'User age in years',
                },
                {
                  name: 'session_count',
                  type: 'number',
                  description: 'Total sessions in last 30 days',
                },
                {
                  name: 'avg_session_duration',
                  type: 'number',
                  description: 'Average session length (minutes)',
                },
                {
                  name: 'page_views',
                  type: 'number',
                  description: 'Total page views',
                },
                {
                  name: 'purchase_history',
                  type: 'number',
                  description: 'Number of purchases',
                },
                {
                  name: 'total_spent',
                  type: 'number',
                  description: 'Total amount spent ($)',
                },
                {
                  name: 'engagement_score',
                  type: 'number',
                  description: 'Computed engagement metric (0-1)',
                },
                {
                  name: 'historical_conversion_rate',
                  type: 'number',
                  description: 'Past conversion rate',
                },
                { name: 'gender', type: 'string', description: 'User gender' },
                {
                  name: 'location',
                  type: 'string',
                  description: 'Geographic location',
                },
              ].map((feature) => (
                <div
                  key={feature.name}
                  className="p-4 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-accent text-sm">{feature.name}</code>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-zinc-500">
                      {feature.type}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">{feature.description}</p>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              Feature Sources
            </h2>

            <p className="text-zinc-400 mb-6">
              Configure the feature source via the{' '}
              <code className="text-accent">FEATURE_SOURCE</code> environment
              variable:
            </p>

            <div className="space-y-4">
              {[
                {
                  source: 'mock',
                  env: 'FEATURE_SOURCE=mock',
                  description:
                    'Synthetic data for development and testing. Default option.',
                  recommended: 'Development',
                },
                {
                  source: 'dynamodb',
                  env: 'FEATURE_SOURCE=dynamodb',
                  description:
                    'Real-time features from DynamoDB. Fast sub-10ms latency.',
                  recommended: 'Production (real-time)',
                },
                {
                  source: 'feature_store',
                  env: 'FEATURE_SOURCE=feature_store',
                  description:
                    'SageMaker Feature Store for ML-optimized feature retrieval.',
                  recommended: 'Production (ML)',
                },
              ].map((item) => (
                <div
                  key={item.source}
                  className="p-5 rounded-xl bg-canvas-light border border-white/5"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <code className="text-accent font-medium">
                      {item.source}
                    </code>
                    <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent">
                      {item.recommended}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mb-3">
                    {item.description}
                  </p>
                  <code className="text-xs text-zinc-500 bg-black/20 px-2 py-1 rounded">
                    {item.env}
                  </code>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Bucket Types</h2>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-white/5 text-center">
                <div className="w-10 h-10 rounded-full bg-accent/20 mx-auto mb-3 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-accent" />
                </div>
                <code className="text-accent font-medium">high_value</code>
                <p className="text-xs text-zinc-500 mt-1">
                  Premium users with high engagement
                </p>
              </div>

              <div className="p-4 rounded-xl border border-white/5 text-center">
                <div className="w-10 h-10 rounded-full bg-violet/20 mx-auto mb-3 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-violet" />
                </div>
                <code className="text-violet font-medium">growth</code>
                <p className="text-xs text-zinc-500 mt-1">
                  Users with growth potential
                </p>
              </div>

              <div className="p-4 rounded-xl border border-white/5 text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-500/20 mx-auto mb-3 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-zinc-400" />
                </div>
                <code className="text-zinc-400 font-medium">standard</code>
                <p className="text-xs text-zinc-500 mt-1">
                  Standard experience users
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              Example Usage
            </h2>

            <div className="terminal mb-6">
              <div className="terminal-header">
                <div className="terminal-dot bg-red-500" />
                <div className="terminal-dot bg-yellow-500" />
                <div className="terminal-dot bg-green-500" />
                <span className="ml-4 text-zinc-500 text-sm">
                  bucket-user.ts
                </span>
              </div>
              <div className="terminal-content">
                <pre className="!bg-transparent !border-0 !p-0">{`// On user login or page load
async function bucketUser(userId: string) {
  const response = await fetch('/api/bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });

  const data = await response.json();
  
  return {
    bucket: data.bucket,           // e.g., 'high_value'
    confidence: data.confidence,   // e.g., 0.87
    experiment: data.experiment_assignment
  };
}

// Example: Route user based on bucket
const { bucket, experiment } = await bucketUser('user_12345');

if (bucket === 'high_value') {
  // Show premium features
  enableFeature('new_checkout_flow');
  trackExperiment(experiment.type, experiment.variant);
}
`}</pre>
              </div>
            </div>

            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot bg-red-500" />
                <div className="terminal-dot bg-yellow-500" />
                <div className="terminal-dot bg-green-500" />
                <span className="ml-4 text-zinc-500 text-sm">
                  response.json
                </span>
              </div>
              <div className="terminal-content">
                <pre className="!bg-transparent !border-0 !p-0">{`{
  "user_id": "user_12345",
  "bucket": "high_value",
  "confidence": 0.87,
  "experiment_assignment": {
    "type": "layout_test",
    "variant": "B"
  },
  "features_used": {
    "engagement_score": 0.82,
    "total_spent": 245.50
  }
}`}</pre>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="card glow-accent text-center py-10">
              <Zap className="w-10 h-10 text-accent mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Try it out</h3>
              <p className="text-zinc-400 mb-6">
                Test the bucketing API in the interactive playground.
              </p>
              <Link
                href="/playground/"
                className="btn-primary inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Open Playground
              </Link>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
