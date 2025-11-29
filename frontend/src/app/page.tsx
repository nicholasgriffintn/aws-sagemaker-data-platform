'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import {
  Users,
  Lightbulb,
  ArrowRight,
  Layers,
  Database,
  Shield,
  Zap,
  GitBranch,
  Cloud,
} from 'lucide-react';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-canvas">
      <Navigation />

      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet/20 rounded-full blur-[128px]" />

        <motion.div
          className="relative z-10 max-w-5xl mx-auto px-6 text-center"
          initial="initial"
          animate="animate"
          variants={stagger}
        >
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm mb-8"
          >
            <Zap className="w-4 h-4" />
            <span>Powered by AWS SageMaker</span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
          >
            <span className="text-white">ML-Driven</span>
            <br />
            <span className="gradient-text">Experimentation Platform</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            A modular platform for running ML-powered experiments. Bucket users
            intelligently, get AI-driven recommendations, and optimize your
            product with data-driven decisions.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/playground/"
              className="btn-primary flex items-center justify-center gap-2"
            >
              Try the Playground
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/api/"
              className="btn-secondary flex items-center justify-center gap-2"
            >
              View API Docs
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-zinc-600 flex items-start justify-center pt-2">
            <div className="w-1 h-3 bg-zinc-600 rounded-full" />
          </div>
        </motion.div>
      </section>

      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Two Powerful Pipelines
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Build intelligent experiments with our ML-powered user bucketing
              and recommendation systems.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="group"
            >
              <Link href="/bucketing/" className="block">
                <div className="card relative overflow-hidden h-full">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-accent/10 rounded-full blur-[64px] group-hover:bg-accent/20 transition-colors" />

                  <div className="relative">
                    <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                      <Users className="w-7 h-7 text-accent" />
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-3">
                      User Bucketing Pipeline
                    </h3>

                    <p className="text-zinc-400 mb-6 leading-relaxed">
                      Classify users into experiment buckets using ML. Based on
                      user features like engagement, purchase history, and
                      behavior patterns, automatically assign them to the right
                      experiments.
                    </p>

                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="px-3 py-1 rounded-full bg-white/5 text-zinc-300 text-sm">
                        Real-time Inference
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white/5 text-zinc-300 text-sm">
                        Feature Store
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white/5 text-zinc-300 text-sm">
                        DynamoDB
                      </span>
                    </div>

                    <div className="flex items-center text-accent group-hover:gap-3 gap-2 transition-all">
                      <span className="font-medium">Learn more</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="group"
            >
              <Link href="/recommender/" className="block">
                <div className="card relative overflow-hidden h-full">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-ember/10 rounded-full blur-[64px] group-hover:bg-ember/20 transition-colors" />

                  <div className="relative">
                    <div className="w-14 h-14 rounded-xl bg-ember/10 flex items-center justify-center mb-6">
                      <Lightbulb className="w-7 h-7 text-ember" />
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-3">
                      ML Recommender Pipeline
                    </h3>

                    <p className="text-zinc-400 mb-6 leading-relaxed">
                      Get intelligent experiment recommendations based on your
                      goals. The ML model predicts which experiments will drive
                      the highest uplift for your target metrics.
                    </p>

                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="px-3 py-1 rounded-full bg-white/5 text-zinc-300 text-sm">
                        Goal Parsing
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white/5 text-zinc-300 text-sm">
                        Uplift Prediction
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white/5 text-zinc-300 text-sm">
                        Bedrock AI
                      </span>
                    </div>

                    <div className="flex items-center text-ember group-hover:gap-3 gap-2 transition-all">
                      <span className="font-medium">Learn more</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-32 relative bg-canvas-light">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Platform Architecture
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              A three-layer architecture built on AWS best practices for ML
              workloads.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="terminal max-w-4xl mx-auto mb-16"
          >
            <div className="terminal-header">
              <div className="terminal-dot bg-red-500" />
              <div className="terminal-dot bg-yellow-500" />
              <div className="terminal-dot bg-green-500" />
              <span className="ml-4 text-zinc-500 text-sm">
                architecture.txt
              </span>
            </div>
            <div className="terminal-content text-zinc-300 overflow-x-auto">
              <pre className="!bg-transparent !border-0 !p-0">{`┌─────────────────────────────────────────────────────────────────┐
│                       ML Pipeline Layer                          │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐ │
│  │   Bucketing Pipeline    │    │   Recommender Pipeline      │ │
│  │  ├─ SageMaker Pipeline  │    │   ├─ SageMaker Pipeline     │ │
│  │  ├─ Inference Endpoint  │    │   ├─ Inference Endpoint     │ │
│  │  └─ API Gateway + Lambda│    │   └─ API Gateway + Lambda   │ │
│  └─────────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Feature Infrastructure Layer                     │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │ DynamoDB             │    │ SageMaker Feature Store      │   │
│  │ (Real-time Features) │    │ (ML-optimized Features)      │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Shared Infrastructure Layer                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Network  │ │   IAM    │ │ Storage  │ │ Lake Formation     │  │
│  │ (VPC)    │ │ (Roles)  │ │ (S3+KMS) │ │ (Data Governance)  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘`}</pre>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0 }}
              className="card"
            >
              <Layers className="w-8 h-8 mb-4 text-accent" />
              <h3 className="text-lg font-semibold text-white mb-2">
                ML Pipeline Layer
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                SageMaker Pipelines handle training, evaluation, and model
                deployment with automatic version control.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="card"
            >
              <Database className="w-8 h-8 mb-4 text-violet" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Feature Layer
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                DynamoDB for real-time features, SageMaker Feature Store for
                ML-optimized feature engineering.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="card"
            >
              <Shield className="w-8 h-8 mb-4 text-ember" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Infrastructure Layer
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                VPC isolation, IAM roles, S3 storage with KMS encryption, and
                Lake Formation governance.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Built for Scale
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Enterprise-ready features for production ML workloads.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: GitBranch,
                title: 'Modular Architecture',
                description:
                  'Add new pipelines easily with shared constructs and patterns.',
              },
              {
                icon: Cloud,
                title: 'CloudFormation Native',
                description:
                  'Fully infrastructure-as-code with AWS CDK and TypeScript.',
              },
              {
                icon: Zap,
                title: 'Real-time Inference',
                description:
                  'Sub-100ms latency with SageMaker endpoints and caching.',
              },
              {
                icon: Shield,
                title: 'Security First',
                description:
                  'VPC isolation, KMS encryption, and Lake Formation governance.',
              },
              {
                icon: Database,
                title: 'Feature Management',
                description:
                  'DynamoDB and SageMaker Feature Store integration.',
              },
              {
                icon: Lightbulb,
                title: 'AI-Powered',
                description:
                  'Optional Bedrock integration for natural language goal parsing.',
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-6 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
              >
                <feature.icon className="w-6 h-6 text-accent mb-4" />
                <h3 className="text-white font-medium mb-2">{feature.title}</h3>
                <p className="text-zinc-500 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-32 relative">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="card glow-accent py-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to experiment?
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto mb-8">
              Try the interactive playground to test the APIs, or dive into the
              documentation to learn how to integrate with your product.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/playground/"
                className="btn-primary flex items-center justify-center gap-2"
              >
                Open Playground
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/api/" className="btn-secondary">
                API Reference
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center text-zinc-500 text-sm">
          AWS ML Platform • Built with AWS CDK, SageMaker, and Next.js
        </div>
      </footer>
    </main>
  );
}
