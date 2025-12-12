'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import {
  Lightbulb,
  Target,
  Brain,
  ListChecks,
  Sparkles,
  TrendingUp,
  Play,
  FlaskConical,
  Bot,
  LineChart,
} from 'lucide-react';

export default function RecommenderPage() {
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
              <div className="w-14 h-14 rounded-xl bg-ember/10 flex items-center justify-center">
                <Lightbulb className="w-7 h-7 text-ember" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  ML Recommender Pipeline
                </h1>
                <p className="text-zinc-500">
                  AI-powered experiment recommendations
                </p>
              </div>
            </div>

            <p className="text-lg text-zinc-400 leading-relaxed">
              The ML Recommender Pipeline helps you decide which experiments to
              run. Describe your goal in natural language, and get ranked
              recommendations with predicted uplift scores based on historical
              experiment data.
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
                  title: 'Define Your Goal',
                  description:
                    'Describe what you want to achieve, e.g., "increase live news engagement for young users".',
                  icon: Target,
                },
                {
                  step: 2,
                  title: 'Goal Parsing',
                  description:
                    'The system parses your goal to extract segment, metric, and context using regex or Bedrock AI.',
                  icon: Brain,
                },
                {
                  step: 3,
                  title: 'Template Matching',
                  description:
                    'Candidate experiment templates are featurized against your parsed goal.',
                  icon: ListChecks,
                },
                {
                  step: 4,
                  title: 'Uplift Prediction',
                  description:
                    'ML model predicts expected uplift for each candidate and returns ranked recommendations.',
                  icon: TrendingUp,
                },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="flex gap-4 p-4 rounded-xl bg-canvas-light border border-white/5"
                >
                  <div className="w-12 h-12 rounded-lg bg-ember/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-6 h-6 text-ember" />
                  </div>
                  <div>
                    <div className="text-xs text-ember mb-1">
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
            <h2 className="text-2xl font-bold text-white mb-6">Goal Parsing</h2>

            <p className="text-zinc-400 mb-6">
              The system extracts structured information from natural language
              goals:
            </p>

            <div className="terminal mb-6">
              <div className="terminal-header">
                <div className="terminal-dot bg-red-500" />
                <div className="terminal-dot bg-yellow-500" />
                <div className="terminal-dot bg-green-500" />
                <span className="ml-4 text-zinc-500 text-sm">
                  goal-parsing.json
                </span>
              </div>
              <div className="terminal-content">
                <pre className="!bg-transparent !border-0 !p-0">{`// Input goal
"increase live news at 18:00 for 16-25s"

// Parsed output
{
  "segment": "16_25",           // Target user segment
  "metric": "live_news_18_consumption",  // Derived metric
  "time_focus": 18              // Time-based targeting
}`}</pre>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-canvas-light border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <code className="text-accent">Regex Parser</code>
                  <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                    Default
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-3">
                  Fast, deterministic pattern matching. Great for
                  well-structured goals.
                </p>
                <code className="text-xs text-zinc-500 bg-black/20 px-2 py-1 rounded">
                  USE_BEDROCK_PARSER=false
                </code>
              </div>

              <div className="p-5 rounded-xl bg-canvas-light border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <code className="text-violet">Bedrock AI</code>
                  <span className="text-xs px-2 py-0.5 rounded bg-violet/10 text-violet">
                    Optional
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-3">
                  AI-powered parsing for complex, natural language goals.
                </p>
                <code className="text-xs text-zinc-500 bg-black/20 px-2 py-1 rounded">
                  USE_BEDROCK_PARSER=true
                </code>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              Experiment Templates
            </h2>

            <p className="text-zinc-400 mb-6">
              The recommender matches goals against a library of experiment
              templates:
            </p>

            <div className="space-y-3">
              {[
                {
                  id: 'live_news_push_16_25',
                  description:
                    'Push reminder for Live News at 18:00 for 16–25s.',
                  type: 'notification_timing',
                  platform: 'app',
                },
                {
                  id: 'tv_live_news_peak_promo',
                  description:
                    'Promote Live News hero module on TV Home during evening peak.',
                  type: 'layout_change',
                  platform: 'tv_app',
                },
                {
                  id: 'article_home_young_reorder',
                  description:
                    'Reorder Homepage to push trending content higher for 16–25s.',
                  type: 'content_order',
                  platform: 'app',
                },
                {
                  id: 'article_page_related_stories_ml',
                  description:
                    'ML-based personalised related-stories module for young adults.',
                  type: 'recommendation_algo_change',
                  platform: 'web',
                },
              ].map((template) => (
                <div
                  key={template.id}
                  className="p-4 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <code className="text-ember text-sm">{template.id}</code>
                    <div className="flex gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-zinc-400">
                        {template.type}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-zinc-400">
                        {template.platform}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400">
                    {template.description}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-sm text-zinc-500 mt-4">
              + 16 more templates available. View full library in{' '}
              <code className="text-accent">
                lambdas/recommender/template_library.json
              </code>
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
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
                  get-recommendations.ts
                </span>
              </div>
              <div className="terminal-content">
                <pre className="!bg-transparent !border-0 !p-0">{`// Get experiment recommendations for a goal
async function getRecommendations(goal: string, topN = 5) {
  const response = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, top_n: topN })
  });

  return response.json();
}

// Example: Get recommendations for engagement goal
const result = await getRecommendations(
  'increase live news at 18:00 for 16-25s',
  3
);

console.log('Parsed goal:', result.parsed);
console.log('Top recommendation:', result.recommendations[0]);

// Run the recommended experiment
const topExperiment = result.recommendations[0];
runExperiment(topExperiment.template_id);
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
  "goal": "increase live news at 18:00 for 16-25s",
  "parsed": {
    "segment": "16_25",
    "metric": "live_news_18_consumption",
    "time_focus": 18
  },
  "recommendations": [
    {
      "template_id": "live_news_push_16_25",
      "description": "Push reminder for Live News at 18:00 for 16–25s.",
      "predicted_uplift": 0.12
    },
    {
      "template_id": "tv_pre_live_news_prompt",
      "description": "Show pre-live news 10-minute prompt for 16–25s.",
      "predicted_uplift": 0.09
    },
    {
      "template_id": "app_live_news_hero_slot",
      "description": "Move live news story into hero slot for mobile.",
      "predicted_uplift": 0.07
    }
  ]
}`}</pre>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              Inside the Recommender Engine
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              These building blocks take a natural-language goal, ground it in
              data, and deliver ranked experiment ideas with uplift estimates.
            </p>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  icon: FlaskConical,
                  title: 'AWS SageMaker',
                  description:
                    'Experiment history lands in S3 and SageMaker trains, evaluates, and versions every recommender model before deploying an endpoint.',
                },
                {
                  icon: Bot,
                  title: 'XGBoost Model',
                  description:
                    'Gradient-boosted trees do a great job on sparse categorical features and learn uplift as a regression problem.',
                },
                {
                  icon: LineChart,
                  title: 'Monitoring + Drift Watch',
                  description:
                    'Metrics Tracker, CloudWatch alarms, and feature logging alert us when predictions change unexpectedly so we can trigger retraining.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-4 rounded-xl border border-white/5 bg-canvas-light h-full"
                >
                  <item.icon className="w-6 h-6 text-ember mb-3" />
                  <h3 className="text-white font-semibold text-base mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="card glow-ember text-center py-10">
              <Sparkles className="w-10 h-10 text-ember mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Try it out</h3>
              <p className="text-zinc-400 mb-6">
                Test the recommender API in the interactive playground.
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
