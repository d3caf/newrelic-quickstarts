import 'dotenv/config';
import promptSync from 'prompt-sync';
import { appendFileSync } from 'node:fs';
import { createValidateQuickstarts } from './create_validate_pr_quickstarts';
import { createValidateDataSources } from './create-validate-data-sources';
import { generatePrUrl } from './lib/github-api-helpers';
import { setDashboardsRequiredDataSources } from './set-dashboards-required-datasources';
import { setAlertPoliciesRequiredDataSources } from './set-alert-policy-required-datasources';

const main = async () => {
  const prompt = promptSync();
  const divider = () => console.log('―――――――――――――――――――――――――――――');
  const stepMessage = (message: string) => {
    divider();
    console.log(message);
    divider();
  };

  let GH_TOKEN = process.env.GH_TOKEN;

  if (!GH_TOKEN) {
    stepMessage('No GitHub token found.');
    GH_TOKEN = prompt.hide('What is your GitHub token? ');

    appendFileSync('.env', `GH_TOKEN=${GH_TOKEN}`);
    console.log(
      'Your GitHub token has been saved to the .env file. Do not commit this file.'
    );
  }

  divider();
  const PR_NUMBER = prompt(
    'What is the PR number for the merge of the release branch into main? '
  );
  divider();

  const PR_URL = generatePrUrl(PR_NUMBER);

  stepMessage('Performing dry run release...');

  // Dry run
  const [dryRunSucceeded, dryRunFailures] = await runTasks(
    PR_URL,
    GH_TOKEN,
    true
  );

  if (dryRunSucceeded) {
    const shouldContinue = prompt(
      'Dry run was successful. Proceed to deploy? (y/n)'
    );

    if (shouldContinue === 'y') {
      stepMessage('🚀 Releasing!');
      // Real deploy
      runTasks(PR_URL, GH_TOKEN, false); 
    } else {
      console.log('Received non-affirmative response. Exiting.');
      process.exit(0);
    }
  }
};

const runTasks = async (url: string, token: string, dryRun = true) => {
  const failures: Record<string, boolean> = {};

  const allSuccess = () =>
    Object.values(failures).every((status) => status === false);

  failures['dataSources'] = await createValidateDataSources(url, token, dryRun);
  failures['quickstarts'] = await createValidateQuickstarts(url, token, dryRun);

  if (!dryRun) {
    failures['dashboardsRequiredDatasources'] =
      await setDashboardsRequiredDataSources(url, token);

    failures['alertPoliciesRequiredDatasources'] =
      await setAlertPoliciesRequiredDataSources(url, token);
  }

  return [allSuccess(), failures];
};

if (require.main === module) {
  main();
}
