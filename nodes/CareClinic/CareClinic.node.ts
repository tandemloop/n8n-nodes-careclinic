import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { accountDescription } from './resources/account';
import { catalogDescription } from './resources/catalog';
import { entryDescription } from './resources/entry';
import { reminderDescription } from './resources/reminder';
import { wellnessDescription } from './resources/wellness';

export class CareClinic implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CareClinic',
		name: 'careClinic',
		icon: { light: 'file:../../icons/careclinic.svg', dark: 'file:../../icons/careclinic.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and log CareClinic entries',
		defaults: {
			name: 'CareClinic',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'careClinicOAuth2Api',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://api.careclinic.io/v1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Catalog', value: 'catalog' },
					{ name: 'Entry', value: 'entry' },
					{ name: 'Reminder', value: 'reminder' },
					{ name: 'Wellness', value: 'wellness' },
				],
				default: 'entry',
			},
			...accountDescription,
			...catalogDescription,
			...entryDescription,
			...reminderDescription,
			...wellnessDescription,
		],
	};
}
