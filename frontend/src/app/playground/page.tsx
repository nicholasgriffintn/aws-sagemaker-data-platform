'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Navigation } from '@/components/Navigation';
import {
  apiConfig,
  isConfigured,
  getBucketingUrl,
  getRecommenderUrl,
} from '@/config/endpoints';
import {
  Play,
  Users,
  Lightbulb,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

type Tab = 'bucketing' | 'recommender';

interface ApiResponse {
  data: unknown;
  status: number;
  error?: string;
}

const SAMPLE_USERS = [
  {
    id: 'user_12345',
    label: 'High-value user',
    description: 'Active with high engagement',
  },
  { id: 'user_67890', label: 'New user', description: 'Recently signed up' },
  {
    id: 'user_24680',
    label: 'Casual browser',
    description: 'Low session count',
  },
];

const SAMPLE_GOALS = [
  {
    goal: 'increase live news at 18:00 for 16-25s',
    label: 'Live News Engagement',
  },
  { goal: 'boost article page views for young adults', label: 'Article Views' },
  {
    goal: 'improve app home engagement for new users',
    label: 'App Home Engagement',
  },
];

export default function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState<Tab>('bucketing');
  const [userId, setUserId] = useState('user_12345');
  const [goal, setGoal] = useState('increase live news at 18:00 for 16-25s');
  const [topN, setTopN] = useState(3);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const configured = isConfigured();

  async function handleSubmit() {
    setLoading(true);
    setResponse(null);

    try {
      if (!configured) {
        await new Promise((resolve) => setTimeout(resolve, 800));

        if (activeTab === 'bucketing') {
          setResponse({
            status: 200,
            data: {
              user_id: userId,
              bucket: 'high_value',
              confidence: 0.87,
              experiment_assignment: {
                type: 'layout_test',
                variant: 'B',
              },
              features_used: {
                engagement_score: 0.82,
                total_spent: 245.5,
              },
            },
          });
        } else {
          setResponse({
            status: 200,
            data: {
              goal: goal,
              parsed: {
                segment: '16_25',
                metric: 'live_news_18_consumption',
                time_focus: 18,
              },
              recommendations: [
                {
                  template_id: 'live_news_push_16_25',
                  description:
                    'Push reminder for Live News at 18:00 for 16–25s.',
                  predicted_uplift: 0.12,
                },
                {
                  template_id: 'tv_pre_live_news_prompt',
                  description:
                    'Show pre-live news 10-minute prompt on TV Home for 16–25s.',
                  predicted_uplift: 0.09,
                },
                {
                  template_id: 'app_live_news_hero_slot',
                  description:
                    'Move live news story into hero slot for mobile users.',
                  predicted_uplift: 0.07,
                },
              ],
            },
          });
        }
      } else {
        const url =
          activeTab === 'bucketing' ? getBucketingUrl() : getRecommenderUrl();
        const body =
          activeTab === 'bucketing'
            ? { user_id: userId }
            : { goal, top_n: topN };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        setResponse({
          status: res.status,
          data,
          error: res.ok ? undefined : data.error,
        });
      }
    } catch (err) {
      setResponse({
        status: 500,
        data: null,
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyResponse() {
    if (response) {
      await navigator.clipboard.writeText(
        JSON.stringify(response.data, null, 2)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <main className="min-h-screen bg-canvas">
      <Navigation />

      <div className="pt-24 pb-32">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-violet flex items-center justify-center">
                <Play className="w-6 h-6 text-canvas" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  API Playground
                </h1>
                <p className="text-zinc-500">Test the ML APIs interactively</p>
              </div>
            </div>
          </motion.div>

          {!configured && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="text-amber-200 font-medium">Demo Mode</p>
                  <p className="text-amber-200/70 text-sm">
                    API endpoints are not configured. The playground will return
                    simulated responses. Deploy the CDK stack to connect to real
                    endpoints.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => {
                    setActiveTab('bucketing');
                    setResponse(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'bucketing'
                      ? 'bg-accent/10 text-accent'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  User Bucketing
                </button>
                <button
                  onClick={() => {
                    setActiveTab('recommender');
                    setResponse(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'recommender'
                      ? 'bg-ember/10 text-ember'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Lightbulb className="w-4 h-4" />
                  Recommender
                </button>
              </div>

              <div className="card">
                {activeTab === 'bucketing' ? (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        User ID
                      </label>
                      <input
                        type="text"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        className="input font-mono"
                        placeholder="Enter user ID..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-3">
                        Quick Select
                      </label>
                      <div className="space-y-2">
                        {SAMPLE_USERS.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => setUserId(user.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              userId === user.id
                                ? 'bg-accent/10 border-accent/30'
                                : 'border-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className="font-mono text-sm text-accent">
                              {user.id}
                            </div>
                            <div className="text-sm text-zinc-300">
                              {user.label}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {user.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Goal Description
                      </label>
                      <textarea
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        className="input min-h-[100px] resize-none"
                        placeholder="Describe your experiment goal..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Number of Recommendations
                      </label>
                      <input
                        type="number"
                        value={topN}
                        onChange={(e) => setTopN(parseInt(e.target.value) || 3)}
                        min={1}
                        max={10}
                        className="input w-24"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-3">
                        Example Goals
                      </label>
                      <div className="space-y-2">
                        {SAMPLE_GOALS.map((sample) => (
                          <button
                            key={sample.goal}
                            onClick={() => setGoal(sample.goal)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              goal === sample.goal
                                ? 'bg-ember/10 border-ember/30'
                                : 'border-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className="text-sm text-zinc-300">
                              {sample.label}
                            </div>
                            <div className="text-xs text-zinc-500 font-mono">
                              {sample.goal}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {activeTab === 'bucketing'
                        ? 'Bucket User'
                        : 'Get Recommendations'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">Response</h3>
                {response && (
                  <button
                    onClick={copyResponse}
                    className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="terminal min-h-[400px]">
                <div className="terminal-header">
                  <div className="terminal-dot bg-red-500" />
                  <div className="terminal-dot bg-yellow-500" />
                  <div className="terminal-dot bg-green-500" />
                  <span className="ml-4 text-zinc-500 text-sm">
                    {response
                      ? `${response.status} ${
                          response.status === 200 ? 'OK' : 'Error'
                        }`
                      : 'response.json'}
                  </span>
                </div>
                <div className="terminal-content">
                  {!response ? (
                    <div className="text-zinc-500 italic">
                      Submit a request to see the response...
                    </div>
                  ) : response.error ? (
                    <div className="text-red-400">Error: {response.error}</div>
                  ) : (
                    <pre className="!bg-transparent !border-0 !p-0 text-zinc-300">
                      {JSON.stringify(response.data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>

              {response && !response.error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    Interpretation
                  </h4>

                  {activeTab === 'bucketing' ? (
                    <div className="space-y-2 text-sm text-zinc-400">
                      <p>
                        User{' '}
                        <span className="text-accent font-mono">
                          {
                            (response.data as Record<string, unknown>)
                              .user_id as string
                          }
                        </span>{' '}
                        has been assigned to the{' '}
                        <span className="text-white font-medium">
                          {
                            (response.data as Record<string, unknown>)
                              .bucket as string
                          }
                        </span>{' '}
                        bucket with{' '}
                        <span className="text-white">
                          {(
                            ((response.data as Record<string, unknown>)
                              .confidence as number) * 100
                          ).toFixed(0)}
                          %
                        </span>{' '}
                        confidence.
                      </p>
                      <p>
                        They should see experiment variant{' '}
                        <span className="text-violet font-medium">
                          {
                            (
                              response.data as Record<
                                string,
                                Record<string, string>
                              >
                            ).experiment_assignment?.variant
                          }
                        </span>
                        .
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm text-zinc-400">
                      <p>
                        Based on the goal, the top recommended experiment is{' '}
                        <span className="text-ember font-medium">
                          {
                            (
                              (
                                response.data as Record<
                                  string,
                                  Array<Record<string, unknown>>
                                >
                              ).recommendations?.[0] as Record<string, string>
                            )?.template_id
                          }
                        </span>{' '}
                        with a predicted uplift of{' '}
                        <span className="text-white">
                          {(
                            ((
                              response.data as Record<
                                string,
                                Array<Record<string, unknown>>
                              >
                            ).recommendations?.[0]
                              ?.predicted_uplift as number) * 100
                          ).toFixed(0)}
                          %
                        </span>
                        .
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Code Example</h2>

            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot bg-red-500" />
                <div className="terminal-dot bg-yellow-500" />
                <div className="terminal-dot bg-green-500" />
                <span className="ml-4 text-zinc-500 text-sm">
                  {activeTab === 'bucketing'
                    ? 'bucket-user.ts'
                    : 'get-recommendations.ts'}
                </span>
              </div>
              <div className="terminal-content">
                {activeTab === 'bucketing' ? (
                  <pre className="!bg-transparent !border-0 !p-0">{`// Bucket a user for experiment assignment
const response = await fetch('${
                    configured ? getBucketingUrl() : '/api/bucket'
                  }', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: '${userId}' })
});

const { bucket, confidence, experiment_assignment } = await response.json();

// Route user based on bucket
if (bucket === 'high_value') {
  showPremiumExperience();
  trackExperiment(experiment_assignment.type, experiment_assignment.variant);
} else {
  showStandardExperience();
}`}</pre>
                ) : (
                  <pre className="!bg-transparent !border-0 !p-0">{`// Get experiment recommendations for a goal
const response = await fetch('${
                    configured ? getRecommenderUrl() : '/api/recommend'
                  }', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    goal: '${goal}',
    top_n: ${topN}
  })
});

const { parsed, recommendations } = await response.json();

// Run the top recommended experiment
const topExperiment = recommendations[0];
console.log(\`Running: \${topExperiment.template_id}\`);
console.log(\`Expected uplift: \${(topExperiment.predicted_uplift * 100).toFixed(0)}%\`);

runExperiment(topExperiment.template_id);`}</pre>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
