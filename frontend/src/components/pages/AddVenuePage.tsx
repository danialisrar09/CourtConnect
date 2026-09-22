import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, Clock, Calendar, DollarSign, MapPin, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { LoadingButton } from '../ui/loading';
import { venueService } from '../../services';

interface VenueImage {
  id: string;
  file?: File;
  url: string;
  name: string;
}

interface Availability {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export function AddVenuePage() {
  const navigate = useNavigate();
  const [venueData, setVenueData] = useState({
    title: '',
    description: '',
    sport: '',
    hourlyPrice: '',
    location: '',
    capacity: '',
    amenities: [] as string[],
    rules: ['', ''] as string[],
    contactPhone: '',
    contactEmail: '',
    surface: '',
    indoor: false,
    lighting: false,
  });

  const [images, setImages] = useState<VenueImage[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([
    { day: 'Monday', enabled: true, startTime: '09:00', endTime: '22:00' },
    { day: 'Tuesday', enabled: true, startTime: '09:00', endTime: '22:00' },
    { day: 'Wednesday', enabled: true, startTime: '09:00', endTime: '22:00' },
    { day: 'Thursday', enabled: true, startTime: '09:00', endTime: '22:00' },
    { day: 'Friday', enabled: true, startTime: '09:00', endTime: '22:00' },
    { day: 'Saturday', enabled: true, startTime: '08:00', endTime: '23:00' },
    { day: 'Sunday', enabled: true, startTime: '08:00', endTime: '21:00' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const sportsOptions = [
    'Tennis', 'Football', 'Basketball', 'Badminton', 'Volleyball', 
    'Table Tennis', 'Cricket', 'Hockey', 'Swimming', 'Gym/Fitness'
  ];

  const amenitiesOptions = [
    'Parking', 'Changing Rooms', 'Showers', 'Equipment Rental', 
    'Lighting', 'Air Conditioning', 'Wi-Fi', 'Cafeteria', 
    'First Aid', 'CCTV Security', 'Lockers', 'Water Fountain'
  ];

  const surfaceOptions = ['Synthetic Grass', 'Clay', 'Carpet', 'Concrete', 'Other'];

  const handleInputChange = (field: string, value: string | boolean) => {
    setVenueData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRuleChange = (index: number, value: string) => {
    setVenueData(prev => {
      const newRules = [...prev.rules];
      newRules[index] = value;
      return { ...prev, rules: newRules };
    });
  };

  const addRule = () => {
    setVenueData(prev => ({
      ...prev,
      rules: [...prev.rules, '']
    }));
  };

  const removeRule = (index: number) => {
    if (venueData.rules.length <= 2) {
      toast.error('At least 2 rules are required');
      return;
    }
    setVenueData(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index)
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const newImage: VenueImage = {
          id: Date.now().toString() + Math.random(),
          file,
          url: e.target?.result as string,
          name: file.name
        };
        setImages(prev => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    
    // Simulate file input change
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    
    // Create a new FileList-like object
    const fileList = Array.from(files);
    const mockEvent = {
      target: { files: fileList }
    } as any;
    
    handleImageUpload(mockEvent);
  };

  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleAmenityToggle = (amenity: string) => {
    setVenueData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const handleAvailabilityChange = (index: number, field: string, value: string | boolean) => {
    setAvailability(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async () => {
    // Client-side validation mirroring backend rules
    if (!venueData.title.trim()) {
      toast.error('Please enter a venue title');
      return;
    }
    if (venueData.title.trim().length < 3) {
      toast.error('Title must be at least 3 characters');
      return;
    }
    if (!venueData.description.trim()) {
      toast.error('Please enter a description');
      return;
    }
    if (venueData.description.trim().length < 20) {
      toast.error('Description must be at least 20 characters');
      return;
    }
    if (!venueData.sport) {
      toast.error('Please select a sport');
      return;
    }
    if (!venueData.hourlyPrice) {
      toast.error('Please enter hourly price');
      return;
    }
    const numericPrice = Number(venueData.hourlyPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      toast.error('Hourly price must be a positive number');
      return;
    }
    if (images.length === 0) {
      toast.error('Please upload at least one image');
      return;
    }
    // Validate rules
    const validRules = venueData.rules.filter(r => r.trim().length >= 10);
    if (validRules.length < 2) {
      toast.error('At least 2 rules are required, each at least 10 characters');
      return;
    }
    // Validate contact email format
    if (venueData.contactEmail && !/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(venueData.contactEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    // Validate contact phone format
    if (venueData.contactPhone && !/^\+?[0-9\s-]{7,20}$/.test(venueData.contactPhone)) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsSubmitting(true);

    try {
      const venuePayload = {
        title: venueData.title.trim(),
        description: venueData.description.trim(),
        sport: venueData.sport,
        hourlyPrice: numericPrice,
        capacity: venueData.capacity ? Number(venueData.capacity) : undefined,
        location: venueData.location.trim(),
        amenities: venueData.amenities,
        images: images.map(img => img.url),
        availability: availability.filter(day => day.enabled),
        rules: venueData.rules.filter(r => r.trim().length >= 10),
        contact: {
          phone: venueData.contactPhone.trim() || undefined,
          email: venueData.contactEmail.trim() || undefined,
        },
        surface: venueData.surface || undefined,
        indoor: venueData.indoor,
        lighting: venueData.lighting,
      };

      // Call the real API
      await venueService.createVenue(venuePayload);
      
      toast.success('Venue created successfully! It will be reviewed and published soon.');
      
      // Navigate back to business dashboard
      navigate('/dashboard/business');
    } catch (error: any) {
      console.error('Failed to create venue:', error);
      const apiMessage = error?.response?.data?.message;
      const apiErrors = error?.response?.data?.errors;
      if (apiErrors && Array.isArray(apiErrors)) {
        apiErrors.forEach((e: any) => {
          toast.error(`${e.field}: ${e.message}`);
        });
      } else {
        toast.error(apiMessage || 'Failed to create venue. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate('/dashboard/business')}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-[#010101]">Add New Venue</h1>
          </div>
        </div>

        <div className="space-y-8">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="title" className="mb-2 block">Venue Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Premier Tennis Center"
                    value={venueData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="sport" className="mb-2 block">Sport Type *</Label>
                  <Select value={venueData.sport} onValueChange={(value: string) => handleInputChange('sport', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sport type" />
                    </SelectTrigger>
                    <SelectContent>
                      {sportsOptions.map(sport => (
                        <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="mb-2 block">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your venue, facilities, and what makes it special..."
                  rows={4}
                  value={venueData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="hourlyPrice" className="mb-2 block">Hourly Price (Rs) *</Label>
                  <div className="relative">
                    <DollarSign className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                    <Input
                      id="hourlyPrice"
                      type="number"
                      placeholder="25"
                      className="pl-10"
                      value={venueData.hourlyPrice}
                      onChange={(e) => handleInputChange('hourlyPrice', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="capacity" className="mb-2 block">Capacity (people)</Label>
                  <Input
                    id="capacity"
                    type="number"
                    placeholder="10"
                    value={venueData.capacity}
                    onChange={(e) => handleInputChange('capacity', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="location" className="mb-2 block">Location</Label>
                  <Input
                    id="location"
                    placeholder="Downtown Sports Complex"
                    value={venueData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Camera className="h-5 w-5 mr-2" />
                Venue Images
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-4">
                {/* Upload Area */}
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#98e209] transition-colors"
                  onDrop={handleImageDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Upload className="h-10 w-10 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg mb-2">Drop images here or click to upload</p>
                  <p className="text-sm text-gray-500 mb-4">
                    Upload up to 10 images (max 5MB each)
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    Choose Images
                  </Button>
                </div>

                {/* Image Preview */}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(image.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          {image.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Amenities */}
          <Card>
            <CardHeader>
              <CardTitle>Amenities & Features</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {amenitiesOptions.map((amenity) => (
                  <div key={amenity} className="flex items-center space-x-2">
                    <Checkbox
                      id={amenity}
                      checked={venueData.amenities.includes(amenity)}
                      onCheckedChange={() => handleAmenityToggle(amenity)}
                    />
                    <Label htmlFor={amenity} className="text-sm">{amenity}</Label>
                  </div>
                ))}
              </div>
              
              {venueData.amenities.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Selected amenities:</p>
                  <div className="flex flex-wrap gap-2">
                    {venueData.amenities.map((amenity) => (
                      <Badge key={amenity} variant="secondary">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Availability */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Availability Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-4">
                {availability.map((day, index) => (
                  <div key={day.day} className="flex items-center space-x-4 p-3 border rounded-lg">
                    <div className="flex items-center space-x-2 w-32">
                      <Checkbox
                        checked={day.enabled}
                        onCheckedChange={(checked: boolean) => 
                          handleAvailabilityChange(index, 'enabled', checked)
                        }
                      />
                      <Label className="font-medium">{day.day}</Label>
                    </div>
                    
                    {day.enabled && (
                      <div className="flex items-center space-x-2 flex-1">
                        <Input
                          type="time"
                          value={day.startTime}
                          onChange={(e) => 
                            handleAvailabilityChange(index, 'startTime', e.target.value)
                          }
                          className="w-32"
                        />
                        <span className="text-gray-500">to</span>
                        <Input
                          type="time"
                          value={day.endTime}
                          onChange={(e) => 
                            handleAvailabilityChange(index, 'endTime', e.target.value)
                          }
                          className="w-32"
                        />
                      </div>
                    )}
                    
                    {!day.enabled && (
                      <div className="flex-1 text-gray-500">
                        Closed
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Court Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Court Rules *</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Add at least 2 rules, each must be at least 10 characters long.</p>
                {venueData.rules.map((rule, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
                    <Input
                      placeholder="e.g., No smoking allowed on the premises"
                      value={rule}
                      onChange={(e) => handleRuleChange(index, e.target.value)}
                      className="flex-1"
                    />
                    {venueData.rules.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeRule(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRule}
                >
                  Add Another Rule
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="contactPhone" className="mb-2 block">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={venueData.contactPhone}
                    onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail" className="mb-2 block">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="venue@example.com"
                    value={venueData.contactEmail}
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Details */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-8">
              <div>
                <Label htmlFor="surface" className="mb-2 block">Surface Type</Label>
                <Select value={venueData.surface} onValueChange={(value: string) => handleInputChange('surface', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select surface type" />
                  </SelectTrigger>
                  <SelectContent>
                    {surfaceOptions.map(surface => (
                      <SelectItem key={surface} value={surface}>{surface}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="indoor"
                    checked={venueData.indoor}
                    onCheckedChange={(checked: boolean) => handleInputChange('indoor', checked)}
                  />
                  <Label htmlFor="indoor" className="text-sm font-medium mb-2">
                    Indoor Court
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lighting"
                    checked={venueData.lighting}
                    onCheckedChange={(checked: boolean) => handleInputChange('lighting', checked)}
                  />
                  <Label htmlFor="lighting" className="text-sm font-medium mb-2">
                    Has Floodlights/Lighting
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard/business')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <LoadingButton
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
            >
              Create Venue
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );
}