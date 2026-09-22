const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		role: {
			type: String,
			enum: ['customer', 'business'],
			required: true,
		},
	},
	{ _id: false }
);

const conversationSchema = new mongoose.Schema(
	{
		customerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'customerId is required'],
			index: true,
		},
		ownerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'ownerId is required'],
			index: true,
		},
		venueId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Venue',
			required: [true, 'venueId is required'],
			index: true,
		},
		participants: {
			type: [participantSchema],
			required: true,
			validate: {
				validator: function (arr) {
					if (!Array.isArray(arr) || arr.length !== 2) return false;

					const userIds = new Set(arr.map((p) => String(p.userId || '')));
					if (userIds.size !== 2) return false;

					const roles = arr.map((p) => p.role);
					return roles.includes('customer') && roles.includes('business');
				},
				message: 'participants must include exactly one customer and one business user.',
			},
		},
		lastMessageText: {
			type: String,
			trim: true,
			maxlength: [1000, 'lastMessageText cannot exceed 1000 characters'],
			default: '',
		},
		lastMessageAt: {
			type: Date,
			default: null,
			index: true,
		},
		lastMessageSenderId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		unreadCounts: {
			type: Map,
			of: Number,
			default: {},
		},
		status: {
			type: String,
			enum: ['active', 'archived'],
			default: 'active',
			index: true,
		},
	},
	{
		timestamps: true,
	}
);

conversationSchema.pre('validate', async function () {
	if (
		this.customerId &&
		this.ownerId &&
		String(this.customerId) === String(this.ownerId)
	) {
		this.invalidate('ownerId', 'customerId and ownerId must be different users.');
	}
});

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index(
	{ customerId: 1, ownerId: 1, venueId: 1, status: 1 },
	{
		unique: true,
		partialFilterExpression: { status: 'active' },
		name: 'uniq_active_customer_owner_venue_conversation',
	}
);

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
