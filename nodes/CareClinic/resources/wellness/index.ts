import type { INodeProperties } from 'n8n-workflow';

const showOnlyForGet = { resource: ['wellness'], operation: ['get'] };

export const wellnessDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['wellness'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get recent symptoms, moods, medications and sleep',
				action: 'Get a wellness snapshot',
				routing: { request: { method: 'GET', url: '/wellness' } },
			},
		],
		default: 'get',
	},
	{
		displayName: 'Days',
		name: 'days',
		type: 'number',
		default: 30,
		typeOptions: { minValue: 1, maxValue: 90 },
		description: 'Number of past days to include',
		displayOptions: { show: showOnlyForGet },
		routing: { send: { type: 'query', property: 'days' } },
	},
];
