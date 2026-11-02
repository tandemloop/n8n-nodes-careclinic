import type { INodeProperties } from 'n8n-workflow';

export const reminderDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['reminder'] } },
		options: [
			{
				name: 'Get Today',
				value: 'getToday',
				description: "Get today's medication schedule",
				action: 'Get reminders for today',
				routing: {
					request: { method: 'GET', url: '/reminders/today' },
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'items' } }] },
				},
			},
		],
		default: 'getToday',
	},
];
