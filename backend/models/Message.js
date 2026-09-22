const mongoose = require('mongoose');

const MAX_MESSAGE_LENGTH = Number(process.env.CHAT_MAX_MESSAGE_LENGTH || 1000);

const statusByUserSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		status: {
			type: String,
			enum: ['sent', 'delivered', 'read'],
			default: 'sent',
			required: true,
		},
		updatedAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ _id: false }
);

const imageSchema = new mongoose.Schema(
	{
		url: {
			type: String,
			trim: true,
			default: '',
		},
		mimeType: {
			type: String,
			trim: true,
			default: '',
		},
		sizeBytes: {
			type: Number,
			min: [0, 'sizeBytes cannot be negative'],
			default: 0,
		},
	},
	{ _id: false }
);

const messageSchema = new mongoose.Schema(
	{
		conversationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Conversation',
			required: [true, 'conversationId is required'],
			index: true,
		},
		senderId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'senderId is required'],
			index: true,
		},
		senderRole: {
			type: String,
			enum: ['customer', 'business'],
			required: [true, 'senderRole is required'],
		},
		contentType: {
			type: String,
			enum: ['text', 'image', 'text_image'],
			default: 'text',
			index: true,
		},
		content: {
			type: String,
			trim: true,
			maxlength: [MAX_MESSAGE_LENGTH, `content cannot exceed ${MAX_MESSAGE_LENGTH} characters`],
			default: '',
		},
		image: {
			type: imageSchema,
			default: undefined,
		},
		clientMessageId: {
			type: String,
			trim: true,
			default: null,
		},
		statusByUser: {
			type: [statusByUserSchema],
			default: [],
		},
	},
	{
		timestamps: true,
	}
);

messageSchema.path('clientMessageId').validate(function (value) {
	if (value === null || value === undefined || value === '') return true;
	return String(value).length <= 120;
}, 'clientMessageId cannot exceed 120 characters');

messageSchema.pre('validate', function () {
	const hasText = String(this.content || '').trim().length > 0;
	const hasImage = Boolean(this.image && String(this.image.url || '').trim());

	if (this.contentType === 'text' && !hasText) {
		this.invalidate('content', 'Text content is required when contentType is text.');
	}

	if (this.contentType === 'image' && !hasImage) {
		this.invalidate('image.url', 'image.url is required when contentType is image.');
	}

	if (this.contentType === 'text_image' && (!hasText || !hasImage)) {
		this.invalidate('contentType', 'Both content and image.url are required when contentType is text_image.');
	}
});

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, createdAt: 1 });
messageSchema.index(
	{ conversationId: 1, clientMessageId: 1 },
	{
		unique: true,
		partialFilterExpression: {
			clientMessageId: { $exists: true, $type: 'string', $gt: '' },
		},
		name: 'uniq_client_message_per_conversation',
	}
);

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
