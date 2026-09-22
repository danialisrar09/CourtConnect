import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import venueService from '../../services/venueService';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { X } from 'lucide-react';
import { toast } from 'sonner';

export default function EditVenuePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('');
  const [hourlyPrice, setHourlyPrice] = useState<number>(0);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [rules, setRules] = useState<string[]>(['', '']);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [location, setLocation] = useState('');
  const [surface, setSurface] = useState('');
  const [indoor, setIndoor] = useState(false);
  const [lighting, setLighting] = useState(false);

  // Local lists mirroring backend enums
  const SPORT_TYPES = [
    'Tennis','Football','Basketball','Badminton','Volleyball',
    'Table Tennis','Cricket','Hockey','Swimming','Gym/Fitness'
  ];
  const AMENITIES = [
    'Parking','Changing Rooms','Showers','Equipment Rental',
    'Lighting','Air Conditioning','Wi-Fi','Cafeteria',
    'First Aid','CCTV Security','Lockers','Water Fountain'
  ];
  const SURFACE_OPTIONS = ['Synthetic Grass', 'Clay', 'Carpet', 'Concrete', 'Other'];

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const resp = await venueService.getVenueById(id!);
        const v = resp?.data?.venue || resp?.data || resp; // handle different shapes
        setTitle(v.title || '');
        setDescription(v.description || '');
        setSport(v.sport || '');
        setHourlyPrice(v.hourlyPrice || 0);
        setAmenities(Array.isArray(v.amenities) ? v.amenities : []);
        setRules(Array.isArray(v.rules) && v.rules.length >= 2 ? v.rules : ['', '']);
        setLocation(v.location || '');
        setContactPhone(v.contact?.phone || '');
        setContactEmail(v.contact?.email || '');
        setSurface(v.surface || '');
        setIndoor(v.indoor || false);
        setLighting(v.lighting || false);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load venue');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const handleRuleChange = (index: number, value: string) => {
    const newRules = [...rules];
    newRules[index] = value;
    setRules(newRules);
  };

  const addRule = () => {
    setRules([...rules, '']);
  };

  const removeRule = (index: number) => {
    if (rules.length <= 2) {
      toast.error('At least 2 rules are required');
      return;
    }
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Validate rules
      const validRules = rules.filter(r => r.trim().length >= 10);
      if (validRules.length < 2) {
        toast.error('At least 2 rules are required, each at least 10 characters');
        setSaving(false);
        return;
      }
      
      // Validate contact email
      if (contactEmail && !/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(contactEmail)) {
        toast.error('Please enter a valid email address');
        setSaving(false);
        return;
      }
      
      // Validate contact phone
      if (contactPhone && !/^\+?[0-9\s-]{7,20}$/.test(contactPhone)) {
        toast.error('Please enter a valid phone number');
        setSaving(false);
        return;
      }
      
      const payload = { 
        title: title.trim(), 
        description: description.trim(), 
        sport, 
        hourlyPrice, 
        location: location.trim() || undefined,
        amenities,
        rules: validRules,
        contact: {
          phone: contactPhone.trim() || undefined,
          email: contactEmail.trim() || undefined,
        },
        surface: surface || undefined,
        indoor,
        lighting,
      };
      const resp = await venueService.updateVenue(id!, payload);
      if (resp?.success) {
        toast.success('Venue updated successfully');
        navigate('/dashboard/business');
      } else {
        setError(resp?.message || 'Update failed');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Edit Venue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-gray-500">Loading...</p>}
            {error && !loading && <p className="text-sm text-red-600">{error}</p>}
            {!loading && !error && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="title" className="mb-2 block">Title</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="location" className="mb-2 block">Location</Label>
                  <Input id="location" value={location} placeholder="e.g. DHA Phase 5, Karachi" onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="description" className="mb-2 block">Description</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sport" className="mb-2 block">Sport</Label>
                    <select id="sport" className="w-full border rounded-md p-2"
                      value={sport} onChange={(e) => setSport(e.target.value)}>
                      <option value="">Select sport</option>
                      {SPORT_TYPES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="price" className="mb-2 block">Hourly Price</Label>
                    <Input id="price" type="number" value={hourlyPrice} onChange={(e) => setHourlyPrice(Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Amenities</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {AMENITIES.map(a => {
                      const checked = amenities.includes(a);
                      return (
                        <label key={a} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) setAmenities(prev => [...prev, a]);
                              else setAmenities(prev => prev.filter(x => x !== a));
                            }}
                          />
                          {a}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Rules Section */}
                <div>
                  <Label className="mb-1 block">Court Rules *</Label>
                  <p className="text-sm text-gray-600 mb-2">At least 2 rules required, each at least 10 characters</p>
                  <div className="space-y-2">
                    {rules.map((rule, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
                        <Input
                          placeholder="e.g., No smoking allowed on the premises"
                          value={rule}
                          onChange={(e) => handleRuleChange(index, e.target.value)}
                          className="flex-1"
                        />
                        {rules.length > 2 && (
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
                </div>

                {/* Contact Information */}
                <div>
                  <Label className="mb-2 block">Contact Information</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contactPhone" className="text-sm mb-2 block">Phone</Label>
                      <Input
                        id="contactPhone"
                        type="tel"
                        placeholder="+1 234 567 8900"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactEmail" className="text-sm mb-2 block">Email</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="venue@example.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div>
                  <Label htmlFor="surface" className="mb-2 block">Surface Type</Label>
                  <select
                    id="surface"
                    className="w-full border rounded-md p-2"
                    value={surface}
                    onChange={(e) => setSurface(e.target.value)}
                  >
                    <option value="">Select surface</option>
                    {SURFACE_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="indoor"
                      checked={indoor}
                      onCheckedChange={(checked: boolean) => setIndoor(checked)}
                    />
                    <Label htmlFor="indoor" className="text-sm font-medium">
                      Indoor Court
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="lighting"
                      checked={lighting}
                      onCheckedChange={(checked: boolean) => setLighting(checked)}
                    />
                    <Label htmlFor="lighting" className="text-sm font-medium">
                      Has Floodlights/Lighting
                    </Label>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 mb-3">
                  <Button onClick={handleSave} className="bg-[#98e209] text-[#010101]" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
