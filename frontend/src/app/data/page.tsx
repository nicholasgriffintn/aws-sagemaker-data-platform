'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import {
  Database,
  FileJson,
  Upload,
  RefreshCw,
  Terminal,
  ArrowRight,
  Folder,
} from 'lucide-react';

export default function DataPage() {
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
                <Database className="w-7 h-7 text-violet" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Data Pipeline</h1>
                <p className="text-zinc-500">
                  Generate and manage training data
                </p>
              </div>
            </div>

            <p className="text-lg text-zinc-400 leading-relaxed">
              The data generator creates synthetic training data for both the
              bucketing and recommender pipelines. Use these tools to test the
              platform locally or generate data for SageMaker training jobs.
            </p>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Data Types</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="card">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <FileJson className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Bucketing Data
                </h3>
                <p className="text-sm text-zinc-400 mb-4">
                  User feature data for training the bucketing model. Includes
                  demographics, engagement metrics, and purchase history.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-white/5 text-zinc-400">
                    50k+ records
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-white/5 text-zinc-400">
                    CSV format
                  </span>
                </div>
              </div>

              <div className="card">
                <div className="w-12 h-12 rounded-lg bg-ember/10 flex items-center justify-center mb-4">
                  <FileJson className="w-6 h-6 text-ember" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Experiment Data
                </h3>
                <p className="text-sm text-zinc-400 mb-4">
                  Historical experiment results for training the recommender
                  model. Includes experiment metadata and measured uplift
                  values.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-white/5 text-zinc-400">
                    100k+ records
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-white/5 text-zinc-400">
                    CSV format
                  </span>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">CLI Commands</h2>

            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-canvas-light border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="w-4 h-4 text-accent" />
                  <span className="text-zinc-300 font-medium">
                    Generate all data
                  </span>
                </div>
                <div className="terminal">
                  <div className="terminal-content !p-3">
                    <code className="text-sm">make generate-data</code>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Generates both bucketing and experiment data using default
                  settings.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-canvas-light border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="w-4 h-4 text-accent" />
                  <span className="text-zinc-300 font-medium">
                    Generate specific data types
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="terminal">
                    <div className="terminal-content !p-3">
                      <code className="text-sm">make generate-bucketing</code>
                    </div>
                  </div>
                  <div className="terminal">
                    <div className="terminal-content !p-3">
                      <code className="text-sm">make generate-experiment</code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-canvas-light border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="w-4 h-4 text-accent" />
                  <span className="text-zinc-300 font-medium">
                    Upload to S3
                  </span>
                </div>
                <div className="terminal">
                  <div className="terminal-content !p-3">
                    <code className="text-sm">
                      make upload-data BUCKET=your-bucket-name
                    </code>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Generates data and uploads to the specified S3 bucket for
                  SageMaker training.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-canvas-light border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="w-4 h-4 text-violet" />
                  <span className="text-zinc-300 font-medium">
                    Python CLI (advanced)
                  </span>
                </div>
                <div className="terminal">
                  <div className="terminal-content !p-3">
                    <pre className="!bg-transparent !border-0 !p-0 text-sm">{`cd data-generator

# Generate all data
python main.py all

# Custom record count
python main.py experiment --records 100000
python main.py bucketing --records 50000

# Generate and upload
python main.py all --upload --bucket my-bucket`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Data Schemas</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Folder className="w-5 h-5 text-accent" />
                  Bucketing Data Schema
                </h3>
                <div className="terminal">
                  <div className="terminal-header">
                    <div className="terminal-dot bg-red-500" />
                    <div className="terminal-dot bg-yellow-500" />
                    <div className="terminal-dot bg-green-500" />
                    <span className="ml-4 text-zinc-500 text-sm">
                      bucketing_data.csv
                    </span>
                  </div>
                  <div className="terminal-content">
                    <pre className="!bg-transparent !border-0 !p-0 text-xs">{`user_id,age,gender,location,session_count,avg_session_duration,page_views,
purchase_history,total_spent,engagement_score,historical_conversion_rate,bucket

user_001,28,female,london,45,12.5,230,8,450.00,0.82,0.15,high_value
user_002,19,male,manchester,12,8.2,65,1,25.00,0.35,0.03,standard
user_003,34,female,edinburgh,78,15.8,520,15,890.00,0.91,0.22,high_value`}</pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Folder className="w-5 h-5 text-ember" />
                  Experiment Data Schema
                </h3>
                <div className="terminal">
                  <div className="terminal-header">
                    <div className="terminal-dot bg-red-500" />
                    <div className="terminal-dot bg-yellow-500" />
                    <div className="terminal-dot bg-green-500" />
                    <span className="ml-4 text-zinc-500 text-sm">
                      experiment_data.csv
                    </span>
                  </div>
                  <div className="terminal-content">
                    <pre className="!bg-transparent !border-0 !p-0 text-xs">{`experiment_id,template_id,segment,metric,surface,platform,content_scope,
experiment_type,num_variants,is_personalised,uses_notifications,measured_uplift

exp_001,live_news_push_16_25,16_25,live_news_consumption,app_home,app,
live_news,notification_timing,2,false,true,0.12

exp_002,tv_live_news_peak_promo,all,live_news_views,tv_home,tv_app,
live_news,layout_change,2,false,false,0.08`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              Local Training
            </h2>

            <p className="text-zinc-400 mb-6">
              Train models locally for development and testing before deploying
              to SageMaker:
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-canvas-light border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-4 h-4 text-accent" />
                  <span className="text-zinc-300 font-medium">
                    Train Bucketing Model
                  </span>
                </div>
                <div className="terminal">
                  <div className="terminal-content !p-3">
                    <code className="text-sm">make train-bucketing</code>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Trains the user classification model using local data.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-canvas-light border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-4 h-4 text-ember" />
                  <span className="text-zinc-300 font-medium">
                    Train Recommender Model
                  </span>
                </div>
                <div className="terminal">
                  <div className="terminal-content !p-3">
                    <code className="text-sm">make train-recommender</code>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Trains the experiment recommendation model using local data.
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              Directory Structure
            </h2>

            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot bg-red-500" />
                <div className="terminal-dot bg-yellow-500" />
                <div className="terminal-dot bg-green-500" />
                <span className="ml-4 text-zinc-500 text-sm">
                  project structure
                </span>
              </div>
              <div className="terminal-content">
                <pre className="!bg-transparent !border-0 !p-0 text-xs">{`data-generator/
├── main.py              # CLI entry point
├── generate_data.py     # Core generation logic
├── schemas.py           # Data schemas and validation
├── user_bucketing.py    # User bucketing utilities
└── requirements.txt     # Python dependencies

sagemaker-scripts/
├── bucketing-pipeline/
│   ├── preprocess.py    # Data preprocessing
│   ├── train.py         # Model training
│   ├── evaluate.py      # Model evaluation
│   └── inference.py     # Inference handler
│
└── recommender-pipeline/
    ├── preprocess.py
    ├── train.py
    ├── evaluate.py
    └── inference.py`}</pre>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
